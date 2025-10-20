import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { article_text } = await req.json();
    
    if (!article_text || article_text.trim().length === 0) {
      throw new Error('Article text is required');
    }

    console.log('Analyzing article, length:', article_text.length);

    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!lovableApiKey) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    // Call Lovable AI to analyze the article
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `You are a content analysis expert for a trading/finance content creator. Analyze articles and extract key information for video content creation.

Your task is to analyze the provided article and return a JSON object with:
1. headline: A catchy, attention-grabbing headline (max 80 chars)
2. key_points: Array of 3-5 key points/takeaways from the article
3. tickers_mentioned: Array of stock tickers or crypto symbols mentioned (uppercase, e.g., ["AAPL", "TSLA", "BTC"])
4. viral_potential: Score 0-100 indicating how viral/engaging this content could be
5. suggested_script_angles: Array of 2-3 creative angles to approach this story in a video
6. category: One of: Stocks, Crypto, ETFs, Options, Earnings, Fed Policy, Market Analysis

Consider these factors for viral_potential:
- Controversy or debate (higher score)
- Breaking news or time-sensitive (higher score)
- Affects many people/widespread impact (higher score)
- Includes shocking statistics or surprising facts (higher score)
- Educational but engaging (moderate score)
- Complex or niche topic (lower score)

Return ONLY valid JSON, no additional text.`
          },
          {
            role: 'user',
            content: `Analyze this article:\n\n${article_text.substring(0, 4000)}`
          }
        ],
        temperature: 0.7,
        max_tokens: 1000
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('Lovable AI error:', errorText);
      throw new Error(`AI analysis failed: ${aiResponse.statusText}`);
    }

    const aiData = await aiResponse.json();
    console.log('AI response received');

    // Parse the AI response
    let analysis;
    try {
      const content = aiData.choices[0].message.content;
      // Remove markdown code blocks if present
      const jsonContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      analysis = JSON.parse(jsonContent);
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      throw new Error('Invalid AI response format');
    }

    console.log('Analysis complete:', analysis);

    return new Response(
      JSON.stringify(analysis),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Article analysis error:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
