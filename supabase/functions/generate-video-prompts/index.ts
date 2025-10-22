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
    const { scenes, format = 'professional' } = await req.json();

    if (!scenes || !Array.isArray(scenes)) {
      throw new Error('Scenes array is required');
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const formatStyles: Record<string, string> = {
      professional: 'cinematic, corporate, high-quality production',
      casual: 'lifestyle, authentic, natural lighting',
      documentary: 'observational, realistic, journalistic style',
      energetic: 'dynamic, fast-paced, vibrant colors'
    };

    const systemPrompt = `You are an expert prompt engineer for Google Veo 3 AI video generation. 
Optimize video generation prompts following these best practices:

1. Be specific and descriptive (50-200 words per prompt)
2. Include cinematography details: camera angles, movement, lighting
3. Specify style: ${formatStyles[format] || formatStyles['professional']}
4. Maintain visual consistency across scenes
5. Use active, vivid language
6. Avoid abstract concepts - focus on concrete visuals

Output ONLY a JSON array with this structure:
[
  {
    "sceneNumber": 1,
    "text": "optimized prompt for Veo 3",
    "duration": 10,
    "styleNotes": "additional context"
  }
]`;

    const userPrompt = `Optimize these scene descriptions for Veo 3 video generation:\n\n${JSON.stringify(scenes, null, 2)}`;

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
          { role: 'user', content: userPrompt }
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
    
    let prompts;
    try {
      const parsed = JSON.parse(content);
      prompts = parsed.prompts || parsed;
    } catch (e) {
      console.error('Failed to parse AI response:', content);
      throw new Error('Invalid AI response format');
    }

    return new Response(
      JSON.stringify({ prompts }),
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
