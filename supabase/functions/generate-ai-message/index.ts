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

    let {
      contact_id,
      agent_id,
      message_type,
      trigger_context,
      channel = 'sms'
    }: GenerateMessageRequest = await req.json();

    console.log(`Generating ${message_type} message for contact ${contact_id}`);

    // If no agent_id provided but contact_id is, check for active product agent
    if (!agent_id && contact_id) {
      const { data: convState } = await supabase
        .from('conversation_state')
        .select('active_agent_id, product_agents!conversation_state_active_agent_id_fkey(*)')
        .eq('contact_id', contact_id)
        .maybeSingle();
      
      if (convState?.active_agent_id) {
        agent_id = convState.active_agent_id;
        console.log(`Auto-detected active agent: ${agent_id}`);
      }
    }

    // Handle test mode
    const isTestMode = trigger_context?.test_mode === true;
    
    let agent: any;
    let conversationState: any = null;
    let contact: any;
    let purchases: any[] = [];
    let recentMessages: any[] = [];

    if (isTestMode) {
      // Use mock data for testing
      console.log('Test mode enabled, using mock data');
      const testAgentType = trigger_context.agent_type || 'customer_service';
      
      agent = {
        id: agent_id,
        product_type: testAgentType,
        product_id: null,
        status: 'active',
        agent_context: {
          test_mode: true,
          customer_goals: trigger_context.customer_goals || 'General support'
        }
      };
      contact = {
        id: contact_id,
        full_name: trigger_context.customer_name || 'Test Customer',
        email: 'test@example.com',
        phone_number: '+1234567890',
        customer_tier: 'LEAD',
        total_spent: 0,
        lead_score: 50,
        engagement_score: 50,
        personality_type: 'relationship_builder'
      };
    } else {
      // Check for agent conflicts
      const { data: convState } = await supabase
        .from('conversation_state')
        .select('active_agent_id, agent_priority, agent_queue')
        .eq('contact_id', contact_id)
        .single();
      conversationState = convState;

      const { data: agentData } = await supabase
        .from('product_agents')
        .select('*')
        .eq('id', agent_id)
        .single();

      if (!agentData) {
        throw new Error('Agent not found');
      }
      agent = agentData;
    }

    const requestPriority = AGENT_PRIORITIES[agent.product_type as keyof typeof AGENT_PRIORITIES] || 1;

    if (!isTestMode) {
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
      const { data: contactData } = await supabase
        .from('contacts')
        .select('*')
        .eq('id', contact_id)
        .single();
      contact = contactData;

      const { data: purchaseData } = await supabase
        .from('purchases')
        .select('*')
        .eq('contact_id', contact_id)
        .order('purchase_date', { ascending: false })
        .limit(5);
      purchases = purchaseData || [];

      const { data: messageData } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', (await supabase
          .from('conversations')
          .select('id')
          .eq('contact_id', contact_id)
          .single())?.data?.id || '')
        .order('created_at', { ascending: false })
        .limit(10);
      recentMessages = messageData || [];
    }

    // Search knowledge base for relevant context with enhanced metadata
    let knowledgeContext = '';
    try {
      const { data: kbData } = await supabase.functions.invoke('search-knowledge-base', {
        body: {
          query: `${agent?.product_type} product information customer support`,
          category: `agent_${agent.product_type}`,
          match_count: 5
        }
      });
      if (kbData?.results && kbData.results.length > 0) {
        // Group results by chapter for structured context
        const byChapter = kbData.results.reduce((acc: any, doc: any) => {
          const chapter = doc.chapter_number || 'general';
          if (!acc[chapter]) acc[chapter] = [];
          acc[chapter].push(doc);
          return acc;
        }, {});
        
        // Build chapter summary
        const chapterList = Object.keys(byChapter)
          .filter(ch => ch !== 'general')
          .map(ch => {
            const firstDoc = byChapter[ch][0];
            return `- Chapter ${ch}${firstDoc.chapter_title ? ': ' + firstDoc.chapter_title : ''}`;
          })
          .join('\n');
        
        // Build detailed content organized by chapter
        const detailedContent = Object.entries(byChapter).map(([chapter, docs]: [string, any]) => {
          const firstDoc = docs[0];
          const headerLabel = chapter !== 'general' 
            ? `Chapter ${chapter}${firstDoc.chapter_title ? ': ' + firstDoc.chapter_title : ''}` 
            : 'General Information';
          
          return `
## ${headerLabel}

${docs.map((doc: any, idx: number) => `
### ${doc.section_title || doc.title || `Section ${idx + 1}`}
${doc.topics?.length ? `Topics: ${doc.topics.join(', ')}` : ''}
${doc.summary ? `Summary: ${doc.summary}` : ''}

${doc.content}
`).join('\n---\n')}
`;
        }).join('\n\n');
        
        knowledgeContext = `
RELEVANT KNOWLEDGE BASE INFORMATION:

${chapterList ? `AVAILABLE CHAPTERS:\n${chapterList}\n\n` : ''}

DETAILED CONTENT:
${detailedContent}

INSTRUCTIONS FOR USING THIS INFORMATION:
- ALWAYS cite the specific chapter when referencing information (e.g., "According to Chapter 3...")
- If asked about chapter location, be specific: "That topic is covered in Chapter X: [Title]"
- Reference section titles and topics to provide detailed, accurate context
- If information spans multiple chapters, mention all relevant chapters
- Use the chapter structure to help the customer navigate the material
`;
        
        console.log(`Knowledge base context: ${kbData.results.length} chunks found, grouped into ${Object.keys(byChapter).length} sections`);
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
${agent?.agent_context?.customer_goals ? `\nCustomer Goals: ${agent.agent_context.customer_goals}` : ''}
${agent?.agent_context?.context ? `\nAdditional Context: ${JSON.stringify(agent.agent_context.context)}` : ''}

YOUR ROLE: ${agent.product_type === 'customer_service' ? 'You handle general inquiries and route to specialists when needed.' : `You focus specifically on ${agent.product_type} and its features.`}

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

    // Call OpenAI directly
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { 
            role: 'user', 
            content: `Generate the ${message_type} message now based on all context above.` 
          }
        ],
        temperature: 0.8,
        response_format: { type: 'json_object' }
      })
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('OpenAI error:', aiResponse.status, errorText);
      throw new Error(`OpenAI error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const messageContent = JSON.parse(aiData.choices[0].message.content);
    console.log('AI generated message:', messageContent);

    if (isTestMode) {
      // In test mode, just return the generated message without saving
      return new Response(
        JSON.stringify({
          success: true,
          test_mode: true,
          message: messageContent
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      );
    }

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