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
    const { scriptText, targetDuration = 30 } = await req.json();

    if (!scriptText) {
      throw new Error('Script text is required');
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const numScenes = Math.ceil(targetDuration / 10); // 10 seconds per scene

    const systemPrompt = `You are a video scene analyzer. Break down scripts into ${numScenes} compelling scenes for video generation.

Each scene should be 8-10 seconds long and include:
1. Scene number
2. Duration in seconds
3. The narration/dialogue text for this scene
4. Detailed visual description suitable for AI video generation
5. Cinematography style (camera angles, movement, lighting)

Output ONLY a JSON array with this structure:
[
  {
    "number": 1,
    "duration": 10,
    "narration": "exact text spoken",
    "visualDescription": "detailed description of what should be shown",
    "style": "cinematography notes: camera movement, angles, lighting"
  }
]`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Analyze this script into ${numScenes} scenes:\n\n${scriptText}` }
        ],
        response_format: { type: 'json_object' }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI API error:', response.status, errorText);
      throw new Error(`AI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    
    let scenes;
    try {
      const parsed = JSON.parse(content);
      scenes = parsed.scenes || parsed;
    } catch (e) {
      console.error('Failed to parse AI response:', content);
      throw new Error('Invalid AI response format');
    }

    return new Response(
      JSON.stringify({ scenes }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
