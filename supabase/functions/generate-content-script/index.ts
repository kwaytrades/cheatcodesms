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
      include_broll = true,
      include_timestamps = true,
      style_guide
    } = await req.json();
    
    if (!article_text || article_text.trim().length === 0) {
      throw new Error('Article text is required');
    }

    console.log('Generating script:', { format, length_seconds, tone, hook_style });

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
      
      'carousel': `LinkedIn Carousel (10 slides):
- Slide 1: Attention-grabbing title + preview
- Slides 2-8: One key point per slide, visual + text
- Slide 9: Summary/key takeaway
- Slide 10: CTA (follow, comment, share resource)
- Keep text minimal, design-friendly
- Professional but engaging tone`
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

    let styleGuideSection = '';
    if (style_guide) {
      styleGuideSection = `\n\nBRAND STYLE GUIDE:
${style_guide.brand_voice ? `Brand Voice: ${style_guide.brand_voice}\n` : ''}${style_guide.content_instructions ? `Content Instructions: ${style_guide.content_instructions}\n` : ''}${style_guide.tone_preferences ? `Tone Preferences: ${style_guide.tone_preferences}\n` : ''}${style_guide.hook_guidelines ? `Hook Guidelines: ${style_guide.hook_guidelines}\n` : ''}${style_guide.cta_templates ? `CTA Templates: ${style_guide.cta_templates}\n` : ''}${style_guide.additional_notes ? `Additional Notes: ${style_guide.additional_notes}` : ''}

IMPORTANT: Follow the brand style guide above closely. It overrides general guidelines where specified.`;
    }

    const systemPrompt = `You are an expert video script writer for trading/finance content creators. Generate engaging, well-structured scripts optimized for the platform and format.

FORMAT GUIDELINES:
${formatGuidelines[format]}

TONE:
${toneInstructions[tone]}

HOOK STYLE:
${hookTemplates[hook_style]}${styleGuideSection}

TARGET LENGTH: ${length_seconds} seconds (approximately ${Math.round(length_seconds * 2.5)} words at conversational pace)

${include_timestamps ? 'TIMESTAMPS: Include timestamps like [HOOK - 0:00-0:05], [MAIN - 0:05-4:30], etc.' : ''}

${include_broll ? 'B-ROLL NOTES: Add suggestions for B-roll footage as [B-roll: description of visual]' : ''}

${include_cta ? 'CTA: Include a clear call-to-action at the end (e.g., "Join our Discord for real-time trade alerts" or "Download the free Algo V6 guide")' : ''}

STRUCTURE YOUR RESPONSE AS:
${include_timestamps ? '[HOOK - 0:00-0:XX]\n' : ''}(Your hook here)

[INTRO - X:XX-X:XX]
(Brief intro)

[MAIN CONTENT - X:XX-X:XX]
(Main content broken into clear sections)
${include_broll ? '[B-roll: relevant visual]' : ''}

[CTA - X:XX-X:XX]
(Call to action)

Return ONLY the formatted script. Do not include any meta-commentary or explanations outside the script.`;

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
        temperature: 0.8,
        max_tokens: 2000
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
