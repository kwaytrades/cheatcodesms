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
    const { 
      article_text,
      format = 'youtube_long',
      length_seconds = 300,
      tone = 'educational',
      hook_style = 'question',
      include_cta = true,
      include_broll = false,
      include_timestamps = false,
      style_guide,
      include_market_data = false,
      market_symbols = ['SPY', 'QQQ', 'AAPL']
    } = await req.json();
    
    if (!article_text || article_text.trim().length === 0) {
      throw new Error('Article text is required');
    }

    console.log('Generating script:', { format, length_seconds, tone, hook_style, include_market_data });

    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!lovableApiKey) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    // Build format-specific guidelines
    const formatGuidelines: Record<string, string> = {
      'youtube_long': `YouTube Long-form (5-15 min):
- Start with a strong hook (5-10 seconds)
- Intro section (20-30 seconds) explaining what viewers will learn
- Main content in 3-4 clear sections with subheadings
- Include natural pauses for B-roll
- End with recap and clear CTA
- Use conversational but professional tone
- Add timestamps for key sections`,
      
      'youtube_short': `YouTube Short (30-60s):
- Hook must grab attention in first 2 seconds
- Get to the point immediately, no intro fluff
- One main idea, explained quickly
- Use punchy, energetic language
- End with a cliffhanger or CTA to watch full video
- Every second counts, no wasted words`,
      
      'tiktok': `TikTok/Reel (15-60s):
- Start with a pattern interrupt or shocking statement
- Fast-paced, high-energy delivery
- Use trending phrases and formats
- Text overlays suggested for key points
- End with engagement hook (comment, share, follow)
- Mobile-first vertical format`,
      
    };

    // Build tone-specific instructions
    const toneInstructions: Record<string, string> = {
      'educational': 'Explain concepts clearly, break down complex topics, use examples and analogies. Professional but approachable.',
      'hype': 'Generate excitement and urgency! Use exclamation points, power words, and create FOMO. Energy level: maximum!',
      'breaking_news': 'Present information quickly and factually. "Just in..." or "Breaking..." style. Urgent but credible.',
      'analytical': 'Deep dive into data and trends. Use statistics, charts mentions, logical reasoning. Thoughtful and measured.',
      'casual': 'Talk like a friend sharing cool info. Relaxed, conversational, use "you" and "we". Approachable and fun.'
    };

    // Build hook templates
    const hookTemplates: Record<string, string> = {
      'question': 'Start with a thought-provoking question that makes viewers want to know the answer.',
      'stat': 'Open with a shocking or surprising statistic that stops the scroll.',
      'story': 'Begin with a short, relatable story or scenario that sets up the topic.',
      'contrarian': 'Challenge conventional wisdom or popular opinion to create intrigue.'
    };

    // Fetch live market data if requested
    let marketDataSection = '';
    if (include_market_data || (style_guide?.instructions && 
        (style_guide.instructions.toLowerCase().includes('market data') || 
         style_guide.instructions.toLowerCase().includes('live data')))) {
      try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        
        const marketResponse = await fetch(`${supabaseUrl}/functions/v1/fetch-market-data`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ symbols: market_symbols }),
        });
        
        const marketResult = await marketResponse.json();
        
        if (marketResult.market_data && marketResult.market_data.quotes.length > 0) {
          marketDataSection = `\n\nLIVE MARKET DATA (as of ${new Date().toLocaleString()}):
${marketResult.market_data.summary}

INSTRUCTION: Integrate this live market data naturally into the script to make the content more timely and relevant. Reference current prices and trends where appropriate.`;
        }
      } catch (error) {
        console.error('Failed to fetch market data:', error);
        // Continue without market data if fetch fails
      }
    }

    // Build system prompt with priority: Custom Style Guide > Custom Tone Preset > Generic
    let systemPrompt = 'You are an expert video script writer for trading/finance content creators. Generate engaging, well-structured scripts optimized for the platform and format.\n\n';
    
    // PRIORITY 1: Custom Style Guide (if exists)
    if (style_guide?.instructions) {
      console.log('Using custom style guide for format:', format);
      systemPrompt += `BRAND STYLE GUIDE (PRIMARY INSTRUCTIONS - FOLLOW EXACTLY):\n${style_guide.instructions}\n\n`;
      
      // PRIORITY 2: Custom Tone Preset (if exists)
      if (style_guide.tone_presets && Array.isArray(style_guide.tone_presets) && style_guide.tone_presets.length > 0) {
        const selectedTonePreset = style_guide.tone_presets.find((tp: any) => tp.name === tone);
        if (selectedTonePreset?.instructions) {
          console.log('Using custom tone preset:', tone);
          systemPrompt += `TONE FOR THIS SCRIPT:\n${selectedTonePreset.instructions}\n\n`;
        }
      }
      
      // Add format info (always needed)
      systemPrompt += `FORMAT: ${format}\n`;
      systemPrompt += `TARGET LENGTH: ${format === 'carousel' ? `${length_seconds} slides` : `${length_seconds} seconds`}\n`;
      
    } else {
      // FALLBACK: Use generic guidelines only if NO custom style guide
      console.log('Using generic guidelines for format:', format);
      
      systemPrompt += `FORMAT GUIDELINES:\n${formatGuidelines[format]}\n\n`;
      systemPrompt += `TONE:\n${toneInstructions[tone]}\n\n`;
      systemPrompt += `HOOK STYLE:\n${hookTemplates[hook_style]}\n\n`;
      systemPrompt += `TARGET LENGTH: ${format === 'carousel' ? `${length_seconds} slides` : `${length_seconds} seconds (approximately ${Math.round(length_seconds * 2.5)} words at conversational pace)`}\n\n`;
    }
    
    // Add market data if available
    if (marketDataSection) {
      systemPrompt += marketDataSection + '\n\n';
    }
    
    // Only add generic optional instructions if NO custom style guide exists
    if (!style_guide?.instructions) {
      if (include_cta) {
        systemPrompt += 'CTA: Include a clear call-to-action at the end (e.g., "Join our Discord for real-time trade alerts" or "Download the free Algo V6 guide")\n\n';
      }
    }
    
    systemPrompt += '\n\nIMPORTANT: Output ONLY the spoken script text. Do NOT include timestamps, B-roll notes, section labels, stage directions, or any meta-instructions. Make it readable as a pure, clean script that someone can read aloud directly.';
    
    console.log('System prompt first 300 chars:', systemPrompt.substring(0, 300));

    // Call Lovable AI to generate script
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
            content: systemPrompt
          },
          {
            role: 'user',
            content: `Create a video script based on this article:\n\n${article_text.substring(0, 3000)}`
          }
        ],
        temperature: 0.9,
        max_tokens: 4000
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('Lovable AI error:', errorText);
      throw new Error(`AI script generation failed: ${aiResponse.statusText}`);
    }

    const aiData = await aiResponse.json();
    const script = aiData.choices[0].message.content.trim();

    // Calculate word count and estimated read time
    const wordCount = script.split(/\s+/).length;
    const estimatedReadTime = Math.round(wordCount / 2.5); // Average speaking rate: 150 words/min = 2.5 words/sec

    console.log('Script generated:', { wordCount, estimatedReadTime });

    return new Response(
      JSON.stringify({ 
        script,
        word_count: wordCount,
        estimated_read_time: estimatedReadTime
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Script generation error:', error);
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
