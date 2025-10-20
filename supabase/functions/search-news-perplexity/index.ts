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
    const { query, recency = 'day' } = await req.json();
    
    if (!query || query.trim().length === 0) {
      throw new Error('Search query is required');
    }

    console.log('Searching Perplexity:', { query, recency });

    const perplexityApiKey = Deno.env.get('PERPLEXITY_API_KEY');
    if (!perplexityApiKey) {
      throw new Error('PERPLEXITY_API_KEY not configured');
    }

    // Map recency to Perplexity's search_recency_filter
    const recencyMap: Record<string, string> = {
      'day': 'day',
      'week': 'week',
      'month': 'month'
    };

    // Call Perplexity API
    const perplexityResponse = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${perplexityApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar-pro',
        messages: [
          {
            role: 'system',
            content: 'You are a news aggregator. Return a JSON array of news articles about the given query. Each article should have: title (string), summary (string, 2-3 sentences), url (string), published_at (ISO date string), and sources (array of source names). Return ONLY valid JSON, no additional text. Limit to 10 most relevant articles.'
          },
          {
            role: 'user',
            content: query
          }
        ],
        temperature: 0.2,
        top_p: 0.9,
        max_tokens: 2000,
        search_recency_filter: recencyMap[recency] || 'day',
        return_related_questions: false,
      }),
    });

    if (!perplexityResponse.ok) {
      const errorText = await perplexityResponse.text();
      console.error('Perplexity API error:', errorText);
      throw new Error(`Perplexity API failed: ${perplexityResponse.statusText}`);
    }

    const perplexityData = await perplexityResponse.json();
    console.log('Perplexity response received');

    // Parse the response
    let articles;
    try {
      const content = perplexityData.choices[0].message.content;
      // Remove markdown code blocks if present
      const jsonContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(jsonContent);
      articles = Array.isArray(parsed) ? parsed : parsed.articles || [];
    } catch (parseError) {
      console.error('Failed to parse Perplexity response:', parseError);
      // Fallback: try to extract structured data from text
      articles = [];
    }

    console.log(`Found ${articles.length} articles`);

    return new Response(
      JSON.stringify({ articles }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Perplexity search error:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        articles: []
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
