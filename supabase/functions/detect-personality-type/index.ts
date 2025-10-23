import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DetectPersonalityRequest {
  contact_id: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { contact_id }: DetectPersonalityRequest = await req.json();

    console.log(`Detecting personality type for contact ${contact_id}`);

    // Get conversation history
    const { data: conversations } = await supabase
      .from('conversations')
      .select('id')
      .eq('contact_id', contact_id)
      .single();

    if (!conversations) {
      return new Response(
        JSON.stringify({ 
          error: 'No conversation history found',
          personality_type: 'relationship_builder', // Default
          confidence: 0
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      );
    }

    const { data: messages } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversations.id)
      .eq('direction', 'inbound')
      .order('created_at', { ascending: false })
      .limit(20);

    if (!messages || messages.length < 3) {
      return new Response(
        JSON.stringify({
          error: 'Not enough messages to analyze',
          personality_type: 'relationship_builder', // Default
          confidence: 0
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      );
    }

    // Get contact activities
    const { data: activities } = await supabase
      .from('contact_activities')
      .select('*')
      .eq('contact_id', contact_id)
      .order('created_at', { ascending: false })
      .limit(50);

    // Build analysis prompt
    const systemPrompt = `You are a psychology expert analyzing customer communication patterns to determine personality type.

PERSONALITY TYPES:

1. ANALYTICAL
   - Data-driven, wants details and proof
   - Asks lots of questions
   - Responds with thoughtful, detailed messages
   - Takes time to make decisions
   - Values accuracy and metrics

2. FAST_DECISION_MAKER
   - Brief responses ("yes", "ok", "got it")
   - Action-oriented
   - Makes quick decisions
   - Doesn't need extensive details
   - Impatient with long explanations

3. RELATIONSHIP_BUILDER
   - Personal, friendly tone
   - Uses emoji frequently
   - Shares personal details
   - Values connection
   - Responds warmly

4. SKEPTIC
   - Questions everything
   - Needs proof/testimonials
   - May express doubts
   - Takes longest to convert
   - Values transparency

CONVERSATION HISTORY:
${messages.map(m => m.body).join('\n')}

ACTIVITY PATTERN:
- Total activities: ${activities?.length || 0}
- Message response speed: ${(activities && activities.filter(a => a.activity_type === 'sms_reply').length > 0) ? 'Fast' : 'Slow'}

Analyze the communication patterns above and determine the personality type.

Return JSON:
{
  "personality_type": "analytical" | "fast_decision_maker" | "relationship_builder" | "skeptic",
  "confidence": 0.0-1.0,
  "traits_detected": ["trait1", "trait2", "trait3"],
  "reasoning": "Brief explanation",
  "recommendations": {
    "tone": "How to communicate with this person",
    "message_length": "short | medium | detailed",
    "emoji_usage": "none | minimal | moderate | frequent"
  }
}`;

    // Call Lovable AI
    const { data: aiResponse, error: aiError } = await supabase.functions.invoke('lovable-chat-completion', {
      body: {
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: 'Analyze this customer now.' }
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' }
      }
    });

    if (aiError) throw aiError;

    const analysis = JSON.parse(aiResponse.choices[0].message.content);
    console.log('Personality analysis:', analysis);

    // Update contact record if confidence is high enough
    if (analysis.confidence >= 0.7) {
      await supabase
        .from('contacts')
        .update({
          personality_type: analysis.personality_type
        })
        .eq('id', contact_id);

      console.log(`Updated contact ${contact_id} personality to: ${analysis.personality_type}`);
    }

    return new Response(
      JSON.stringify(analysis),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );
  } catch (error) {
    console.error('Error in detect-personality-type:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});