import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GenerateMessageRequest {
  contact_id: string;
  agent_id: string;
  message_type: 'introduction' | 'check_in' | 'upsell' | 'retention' | 'expiration_notice' | 'onboarding';
  trigger_context: Record<string, any>;
  channel?: 'sms' | 'email';
}

const AGENT_NAMES = {
  webinar: 'Wendi',
  textbook: 'Thomas',
  flashcards: 'Frank',
  algo_monthly: 'Adam',
  ccta: 'Chris',
  lead_nurture: 'Jamie',
  sales_agent: 'Sam',
  customer_service: 'Casey',
};

const AGENT_PRIORITIES = {
  customer_service: 10,
  sales_agent: 5,
  webinar: 3,
  textbook: 3,
  flashcards: 3,
  algo_monthly: 3,
  ccta: 3,
  lead_nurture: 1,
};

const PERSONALITY_TONES = {
  analytical: {
    style: 'Professional, data-driven, detailed',
    length: 'Detailed with specific metrics and facts',
    emoji_usage: 'Minimal',
    example_opening: 'Based on your progress...'
  },
  fast_decision_maker: {
    style: 'Brief, action-oriented, direct',
    length: 'Short and to the point',
    emoji_usage: 'Moderate',
    example_opening: 'Quick question:'
  },
  relationship_builder: {
    style: 'Personal, friendly, warm',
    length: 'Conversational, medium length',
    emoji_usage: 'Frequent',
    example_opening: 'Hey! Just wanted to check in 😊'
  },
  skeptic: {
    style: 'Transparent, proof-based, honest',
    length: 'Detailed with evidence and testimonials',
    emoji_usage: 'Minimal',
    example_opening: "Here's exactly what happened..."
  }
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const {
      contact_id,
      agent_id,
      message_type,
      trigger_context,
      channel = 'sms'
    }: GenerateMessageRequest = await req.json();

    console.log(`Generating ${message_type} message for contact ${contact_id}`);

    // Check for agent conflicts
    const { data: conversationState } = await supabase
      .from('conversation_state')
      .select('active_agent_id, agent_priority, agent_queue')
      .eq('contact_id', contact_id)
      .single();

    const { data: agent } = await supabase
      .from('product_agents')
      .select('*')
      .eq('id', agent_id)
      .single();

    if (!agent) {
      throw new Error('Agent not found');
    }

    const requestPriority = AGENT_PRIORITIES[agent.product_type as keyof typeof AGENT_PRIORITIES] || 1;

    // If another agent has priority, add to queue instead
    if (conversationState?.active_agent_id && 
        conversationState.active_agent_id !== agent_id && 
        (conversationState.agent_priority || 0) > requestPriority) {
      
      console.log(`Agent conflict detected for ${agent.product_type}, adding to queue`);
      
      const currentQueue = conversationState.agent_queue || [];
      await supabase
        .from('conversation_state')
        .update({
          agent_queue: [...currentQueue, {
            agent_id,
            message_type,
            queued_at: new Date().toISOString(),
          }],
        })
        .eq('contact_id', contact_id);
        
      return new Response(
        JSON.stringify({
          success: true,
          queued: true,
          message: 'Message queued due to active agent with higher priority',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    // Update active agent
    await supabase
      .from('conversation_state')
      .update({
        active_agent_id: agent_id,
        agent_priority: requestPriority,
      })
      .eq('contact_id', contact_id);

    // Load full customer context
    const { data: contact } = await supabase
      .from('contacts')
      .select('*')
      .eq('id', contact_id)
      .single();

    const { data: purchases } = await supabase
      .from('purchases')
      .select('*')
      .eq('contact_id', contact_id)
      .order('purchase_date', { ascending: false })
      .limit(5);

    const { data: recentMessages } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', (await supabase
        .from('conversations')
        .select('id')
        .eq('contact_id', contact_id)
        .single())?.data?.id || '')
      .order('created_at', { ascending: false })
      .limit(10);

    // Search knowledge base for relevant context
    let knowledgeContext = '';
    try {
      const { data: kbData } = await supabase.functions.invoke('search-knowledge-base', {
        body: {
          query: `${agent?.product_type} product information customer support`,
          match_count: 3
        }
      });
      if (kbData?.results) {
        knowledgeContext = kbData.results.map((r: any) => r.content).join('\n\n');
      }
    } catch (kbError) {
      console.error('Knowledge base search failed:', kbError);
    }

    // Detect personality type or use existing
    const personalityType = contact?.personality_type || 'relationship_builder';
    const toneGuidelines = PERSONALITY_TONES[personalityType as keyof typeof PERSONALITY_TONES];

    // Get agent name
    const agentName = AGENT_NAMES[agent.product_type as keyof typeof AGENT_NAMES] || 'Your Agent';

    // Build AI prompt
    const systemPrompt = `You are ${agentName}, an elite product concierge agent for ${agent?.product_type || 'our product'}.

Your role is to send personalized, conversational messages that feel like they're from a real person who knows the customer's journey, NOT marketing automation.

CUSTOMER PROFILE:
- Name: ${contact?.full_name || 'Customer'}
- Email: ${contact?.email}
- Phone: ${contact?.phone_number}
- Tier: ${contact?.customer_tier || 'LEAD'}
- Total Spent: $${contact?.total_spent || 0}
- Lead Score: ${contact?.lead_score || 0}
- Engagement Score: ${contact?.engagement_score || 0}
- Personality Type: ${personalityType}

AGENT CONTEXT:
${JSON.stringify(agent?.agent_context || {}, null, 2)}

CONVERSATION HISTORY (last 10 messages):
${recentMessages?.map(m => `${m.sender}: ${m.body}`).join('\n') || 'No previous messages'}

TRIGGER CONTEXT:
${JSON.stringify(trigger_context, null, 2)}

KNOWLEDGE BASE CONTEXT:
${knowledgeContext}

TONE GUIDELINES FOR ${personalityType.toUpperCase()}:
- Style: ${toneGuidelines.style}
- Length: ${toneGuidelines.length}
- Emoji usage: ${toneGuidelines.emoji_usage}
- Example opening: ${toneGuidelines.example_opening}

MESSAGE TYPE: ${message_type}

YOUR TASK:
Generate a ${channel === 'sms' ? 'text message (max 320 characters)' : 'email'} that:
1. Introduces yourself as ${agentName} (use this name naturally)
2. References their specific goals/challenges from agent_context
3. Feels conversational and personal, not robotic
4. Matches their personality type
5. Has a clear but soft CTA
6. Uses their name naturally

CRITICAL RULES:
- Always sign as ${agentName}
- Never sound like marketing automation
- Reference specific details from their journey
- Match the tone to personality type
- Keep SMS under 320 characters
- For email, keep under 150 words

Return JSON:
{
  "subject": "..." (only for email, null for SMS),
  "message": "...",
  "reasoning": "Why this message fits this customer now"
}`;

    // Call Lovable AI
    const { data: aiResponse, error: aiError } = await supabase.functions.invoke('lovable-chat-completion', {
      body: {
        model: 'google/gemini-2.5-pro',
        messages: [
          { role: 'system', content: systemPrompt },
          { 
            role: 'user', 
            content: `Generate the ${message_type} message now based on all context above.` 
          }
        ],
        temperature: 0.8,
        response_format: { type: 'json_object' }
      }
    });

    if (aiError) throw aiError;

    const messageContent = JSON.parse(aiResponse.choices[0].message.content);
    console.log('AI generated message:', messageContent);

    // Schedule the message to be sent immediately
    const { data: scheduledMessage, error: scheduleError } = await supabase
      .from('scheduled_messages')
      .insert({
        contact_id,
        agent_id,
        message_type,
        channel,
        scheduled_for: new Date().toISOString(),
        status: 'pending',
        subject: messageContent.subject,
        message_body: messageContent.message,
        personalization_data: {
          trigger_context,
          personality_type: personalityType,
          reasoning: messageContent.reasoning
        }
      })
      .select()
      .single();

    if (scheduleError) throw scheduleError;

    // Send it immediately
    const { error: sendError } = await supabase.functions.invoke('send-scheduled-message', {
      body: { scheduled_message_id: scheduledMessage.id }
    });

    if (sendError) {
      console.error('Error sending message:', sendError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: messageContent,
        scheduled_message_id: scheduledMessage.id
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );
  } catch (error) {
    console.error('Error in generate-ai-message:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});