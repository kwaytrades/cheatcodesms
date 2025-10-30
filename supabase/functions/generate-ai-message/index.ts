import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GenerateMessageRequest {
  contact_id: string;
  agent_id: string;
  conversation_id?: string; // ✅ Optional conversation ID for persistent history
  message_type: 'introduction' | 'check_in' | 'upsell' | 'retention' | 'expiration_notice' | 'onboarding' | 'handoff';
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
  sales_agent: 10,      // Highest priority in normal mode
  webinar: 8,           // Highest product agent (UPDATED: was 6, now 8)
  textbook: 5,
  flashcards: 4,
  algo_monthly: 4,
  ccta: 4,
  lead_nurture: 3,
  customer_service: 2   // Lowest in normal mode
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
      agent_id: initialAgentId,
      conversation_id,
      message_type,
      trigger_context,
      channel = 'sms'
    }: GenerateMessageRequest = await req.json();
    
    let agent_id = initialAgentId;

    // Preserve message_type to prevent variable shadowing
    const originalMessageType = message_type;
    
    // Validate critical parameters
    if (!originalMessageType) {
      throw new Error('message_type is required but was not provided');
    }

    console.log('═══════════════════════════════════════════════');
    console.log('GENERATE-AI-MESSAGE INVOKED');
    console.log('═══════════════════════════════════════════════');
    console.log('Contact ID:', contact_id);
    console.log('Agent ID:', agent_id);
    console.log('Conversation ID:', conversation_id);
    console.log('Message Type:', originalMessageType);
    console.log('Channel:', channel);
    console.log('Trigger Context:', JSON.stringify(trigger_context));
    console.log('═══════════════════════════════════════════════');

    // If no agent_id provided but contact_id is, check for active agent
    if (!agent_id && contact_id) {
      const { data: convState } = await supabase
        .from('conversation_state')
        .select('active_agent_id')
        .eq('contact_id', contact_id)
        .maybeSingle();
      
      if (convState?.active_agent_id) {
        agent_id = convState.active_agent_id;
        console.log(`Auto-detected active agent: ${agent_id}`);
      }
    }

    // Handle test mode
    const isTestMode = trigger_context?.test_mode === true;
    
    // Fetch conversation history from database if conversationId provided (for test mode)
    let recentMessages: any[] = [];
    if (isTestMode && conversation_id) {
      const { data: messageData, error: msgError } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversation_id)
        .order('created_at', { ascending: false })
        .limit(20);
      
      if (msgError) {
        console.error('Error fetching conversation history:', msgError);
      } else {
        recentMessages = messageData || [];
        console.log(`Fetched ${recentMessages.length} messages for test conversation`);
      }
    }
    
    let agent: any;
    let conversationState: any = null;
    let contact: any;
    let purchases: any[] = [];

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
          customer_goals: trigger_context.customer_goals || 'General support',
          personality_type: trigger_context.personality_type || 'analytical',
          engagement_level: trigger_context.engagement_level || 'medium',
          context: {
            simulation_mode: true,
            campaign_day: trigger_context.campaign_day,
            message_goal: trigger_context.message_goal
          }
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
        personality_type: trigger_context.personality_type || 'analytical'
      };
    } else {
      // Check for agent conflicts
      const { data: convState } = await supabase
        .from('conversation_state')
        .select('active_agent_id, agent_priority, agent_queue')
        .eq('contact_id', contact_id)
        .single();
      conversationState = convState;

      // Try agent_conversations first (for sales campaigns)
      const { data: conversationAgent } = await supabase
        .from('agent_conversations')
        .select('*')
        .eq('id', agent_id)
        .maybeSingle();

      if (conversationAgent) {
        // Normalize the field name for consistency
        agent = {
          ...conversationAgent,
          product_type: conversationAgent.agent_type, // Alias agent_type as product_type
        };
        console.log(`Found agent in agent_conversations: ${agent.product_type}`);
      } else {
        // Fallback to product_agents
        const { data: productAgent } = await supabase
          .from('product_agents')
          .select('*')
          .eq('id', agent_id)
          .maybeSingle();
        
        if (!productAgent) {
          throw new Error(`Agent not found in either agent_conversations or product_agents: ${agent_id}`);
        }
        agent = productAgent;
        console.log(`Found agent in product_agents: ${agent.product_type}`);
      }
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
    const customInstructions = trigger_context?.custom_instructions || '';
    const messageGoal = trigger_context?.message_goal || '';
    
    try {
      // Build smarter search query from context
      const kbSearchQuery = [
        agent?.product_type,
        customInstructions || message_type,
        messageGoal,
        trigger_context.message_type
      ].filter(Boolean).join(' ').substring(0, 200);
      
      const { data: kbData } = await supabase.functions.invoke('search-knowledge-base', {
        body: {
          query: kbSearchQuery,
          category: `agent_${agent.product_type}`,
          match_count: 15
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

    // Fetch customer profile for personalization
    console.log('📊 Fetching customer profile...');
    let customerProfile = null;
    try {
      const { data: profileData, error: profileError } = await supabase.rpc(
        'get_customer_profile',
        { p_contact_id: contact_id }
      );

      if (profileError) {
        console.error('Error fetching customer profile:', profileError);
      } else {
        customerProfile = profileData;
        console.log('Customer Profile:', {
          tier: customerProfile?.financial?.tier,
          productsOwned: customerProfile?.financial?.productsOwned,
          leadScore: customerProfile?.engagement?.leadScore,
          tradingExperience: customerProfile?.trading?.experience,
          personalityType: customerProfile?.behavioral?.personalityType
        });
      }
    } catch (profileError) {
      console.error('Failed to fetch customer profile:', profileError);
    }

    // Detect personality type or use existing
    const personalityType = contact?.personality_type || 'relationship_builder';
    const toneGuidelines = PERSONALITY_TONES[personalityType as keyof typeof PERSONALITY_TONES];

    // Get agent name
    const agentName = AGENT_NAMES[agent.product_type as keyof typeof AGENT_NAMES] || 'Your Agent';

    // Fetch agent type config for custom system prompt and tone (always load, even in test mode)
    let agentConfig: any = null;
    const { data: configData } = await supabase
      .from('agent_type_configs')
      .select('system_prompt, tone')
      .eq('agent_type', agent.product_type)
      .maybeSingle();
    agentConfig = configData;

    // Add campaign context if available
    let campaignContext = '';
    let campaignStrategy: any = null;
    
    // Fetch campaign strategy from agent's key_entities (for sales campaigns)
    if (agent.key_entities?.campaign_strategy) {
      campaignStrategy = agent.key_entities.campaign_strategy;
      console.log('Using campaign strategy from agent key_entities');
    } else if (conversation_id) {
      // Fallback: Fetch campaign strategy from conversation metadata
      const { data: conversationData } = await supabase
        .from('agent_conversations')
        .select('key_entities')
        .eq('id', conversation_id)
        .maybeSingle();
      
      if (conversationData?.key_entities?.campaign_strategy) {
        campaignStrategy = conversationData.key_entities.campaign_strategy;
        console.log('Using campaign strategy from conversation key_entities');
      }
    }
    
    // Build campaign context if strategy is available
    if (campaignStrategy) {
      campaignContext = `
═══════════════════════════════════════════════════════
🎯 CAMPAIGN STRATEGY - CRITICAL CONTEXT
═══════════════════════════════════════════════════════

PRIMARY OBJECTIVE: ${campaignStrategy.primary_objective?.replace('_', ' ').toUpperCase() || 'Not specified'}
PRODUCTS: ${campaignStrategy.products?.join(', ') || 'Not specified'}
SALES INTENSITY: ${campaignStrategy.sales_intensity}/10 ${campaignStrategy.sales_intensity >= 8 ? '(HIGH - AGGRESSIVE)' : campaignStrategy.sales_intensity >= 5 ? '(MODERATE - BALANCED)' : '(LOW - SOFT TOUCH)'}

VALUE PROPOSITIONS:
${campaignStrategy.value_propositions?.map((vp: string) => `• ${vp}`).join('\n') || 'None specified'}

${campaignStrategy.pricing?.base_price ? `PRICING: ${campaignStrategy.pricing.base_price}` : ''}
${campaignStrategy.pricing?.special_offer ? `SPECIAL OFFER: ${campaignStrategy.pricing.special_offer}` : ''}

DISCOUNT STRATEGY: ${campaignStrategy.discount_strategy?.approach?.replace('_', ' ').toUpperCase() || 'No discounts'}
${campaignStrategy.discount_strategy?.amount ? `Discount Amount: ${campaignStrategy.discount_strategy.amount}` : ''}
${campaignStrategy.discount_strategy?.expiration ? `Expires: ${campaignStrategy.discount_strategy.expiration}` : ''}

OBJECTION HANDLING: ${campaignStrategy.objection_handling?.replace('_', ' ') || 'Address with education'}

${campaignStrategy.campaign_context ? `CAMPAIGN CONTEXT:\n${campaignStrategy.campaign_context}\n` : ''}

${campaignStrategy.key_talking_points?.length ? `KEY TALKING POINTS (MUST MENTION):\n${campaignStrategy.key_talking_points.map((tp: string) => `✓ ${tp}`).join('\n')}\n` : ''}

${campaignStrategy.avoid_topics?.length ? `⚠️ TOPICS TO AVOID:\n${campaignStrategy.avoid_topics.map((at: string) => `✗ ${at}`).join('\n')}\n` : ''}

${campaignStrategy.competitive_positioning ? `COMPETITIVE POSITIONING:\n${campaignStrategy.competitive_positioning}\n` : ''}

═══════════════════════════════════════════════════════
`;
    }
    
    if (trigger_context?.campaign_day !== undefined) {
      const { data: agentConfig } = await supabase
        .from('agent_type_configs')
        .select('campaign_config')
        .eq('agent_type', agent.product_type)
        .single();

      const duration = agentConfig?.campaign_config?.duration_days || 90;
      const campaignStage = getCampaignStage(trigger_context.campaign_day, duration);
      
      campaignContext += `

═══════════════════════════════════════════════════════
CAMPAIGN TIMELINE - Day ${trigger_context.campaign_day} of ${duration}
═══════════════════════════════════════════════════════

📅 Progress: ${Math.round((trigger_context.campaign_day / duration) * 100)}% through campaign (${campaignStage})
🎯 Goal: "${messageGoal}" | Type: "${trigger_context.message_type}"
📝 Channel: ${trigger_context.message_channel || 'sms'}
${trigger_context.customer_goals ? `👤 Goals: ${trigger_context.customer_goals} | Personality: ${trigger_context.personality_type || 'Unknown'}` : ''}`;
    }

    function getCampaignStage(day: number, duration: number): string {
      const pct = (day / duration) * 100;
      if (pct < 10) return 'Onboarding';
      if (pct < 30) return 'Early Engagement';
      if (pct < 60) return 'Active Learning';
      if (pct < 85) return 'Advanced Content';
      return 'Conversion Phase';
    }

    // Add conversation awareness to system prompt
    let conversationAwarenessPrompt = '';
    if (trigger_context?.recent_conversation) {
      const rc = trigger_context.recent_conversation;
      
      if (rc.was_very_recent) {
        conversationAwarenessPrompt = `

⚠️ CONVERSATION AWARENESS - CRITICAL:
You spoke with this customer ${Math.floor(rc.hours_since_last_engagement)} hours ago.
Last Topic Discussed: ${rc.last_topic || 'Not recorded'}
Recent Exchange: ${rc.recent_messages_summary || 'No recent messages'}

MANDATORY ADJUSTMENTS:
- Start with acknowledgment: "I know we just spoke yesterday, but..."
- Reference the actual topic you discussed: "Following up on our conversation about ${rc.last_topic?.substring(0, 50)}..."
- Make this feel like a natural continuation, NOT a scheduled check-in
- Example: "Hey! I know we chatted yesterday about your progress. Just wanted to quickly check - were you able to review that section we discussed?"

DO NOT send generic campaign messages when you have recent context!`;
      } else if (rc.was_recent_conversation) {
        conversationAwarenessPrompt = `

CONVERSATION AWARENESS:
You had a conversation with this customer ${Math.floor(rc.hours_since_last_engagement / 24)} days ago.
Last Topic: ${rc.last_topic?.substring(0, 100) || 'Not specified'}

ADJUSTMENTS:
- Acknowledge the previous conversation: "Hope you've been well since we last talked..."
- Reference what you discussed if relevant to today's message
- Bridge naturally from past conversation to this check-in`;
      }
    }

    // Build campaign context for ai-agent
    const campaignContextPayload = {
      customInstructions: customInstructions || `Send a ${message_type} message`,
      messageGoal: messageGoal,
      messageType: message_type,
      channel: channel,
      campaignDay: trigger_context.campaign_day || 0,
      totalDays: 90, // Could be from campaign config
      stage: trigger_context.stage || 'active',
      personalityType: personalityType
    };

    // Declare messageContent for use in handoff or ai-agent paths
    let messageContent: { subject: string | null; message: string; reasoning: string };

    // HANDOFF MESSAGE - When sales agent takes over from another agent
    if (message_type === 'handoff' && trigger_context.previous_agent_type) {
      const previousAgentName = AGENT_NAMES[trigger_context.previous_agent_type as keyof typeof AGENT_NAMES] || 'your previous agent';
      const commandMap: Record<string, string> = {
        textbook: '/textbook',
        flashcards: '/flashcards',
        webinar: '/webinar',
        algo_monthly: '/algo',
        ccta: '/ccta',
        lead_nurture: '/nurture',
        customer_service: '/help'
      };
      const switchCommand = commandMap[trigger_context.previous_agent_type] || '/help';
      
      const campaignGoal = campaignStrategy?.primary_objective?.replace('_', ' ') || 'help you succeed';
      const products = campaignStrategy?.products?.join(' and ') || 'our products';
      
      const handoffMessage = `Hey ${contact?.first_name || 'there'}! 👋 This is ${agentName} from Cheat Code's sales team.

I noticed you've been working with ${previousAgentName} - that's awesome! I'm jumping in to help you with ${campaignGoal} and make sure you're getting the most out of ${products}.

${campaignStrategy?.campaign_context || 'I wanted to reach out personally to see how I can support your journey.'} 

If you'd like to continue your conversation with ${previousAgentName}, just reply with ${switchCommand} anytime. 

What questions can I answer for you? 🚀`;

      console.log('✅ Generated handoff message for agent takeover');
      
      messageContent = {
        subject: null,
        message: handoffMessage,
        reasoning: 'Sales agent handoff from ' + trigger_context.previous_agent_type
      };

      console.log('🎯 Handoff message created, proceeding to schedule + send');
      
    } else {
      // For non-handoff messages, log campaign details and call ai-agent
      console.log('═══════════════════════════════════════════════');
      console.log('CAMPAIGN MESSAGE REQUEST');
      console.log('═══════════════════════════════════════════════');
      console.log('Agent Type:', agent?.product_type);
      console.log('Campaign Day:', campaignContextPayload.campaignDay);
      console.log('Message Goal:', messageGoal);
      console.log('Custom Instructions:', customInstructions?.substring(0, 80) || 'NONE');
      console.log('Channel:', channel);
      console.log('Personality:', personalityType);
      console.log('═══════════════════════════════════════════════');

      // Format conversation history for ai-agent
      const formattedMessages = (recentMessages || []).reverse().map((msg: any) => ({
        sender: msg.sender,
        content: msg.body,
        body: msg.body,
        created_at: msg.created_at
      }));

      console.log(`Calling ai-agent with ${formattedMessages.length} messages and campaign context`);

      // Normalize agent type to match ai-agent expectations
      const normalizedAgentType = agent.product_type === 'sales_agent' ? 'sales' : 
                                  agent.product_type === 'customer_service' ? 'cs' : 
                                  agent.product_type;

      // Call ai-agent with campaign context
      const { data: aiAgentData, error: aiAgentError } = await supabase.functions.invoke('ai-agent', {
        body: {
          ...(isTestMode ? {} : { conversationId: conversation_id }),
          agentType: normalizedAgentType,
          incomingMessage: trigger_context.last_customer_message || `Generate ${message_type} message`,
          messages: formattedMessages,
          isFirstMessage: formattedMessages.length === 0,
          contactId: contact_id,
          agentContext: agent.agent_context,
          context: {
            contact,
            purchases,
            customerProfile,
            messageType: message_type,
            channel
          },
          campaignContext: campaignContextPayload
        }
      });

      if (aiAgentError) {
        console.error('ai-agent error:', aiAgentError);
        throw new Error(`ai-agent failed: ${aiAgentError.message || 'Unknown error'}`);
      }

      console.log('✅ ai-agent response received');

      messageContent = {
        subject: null,
        message: aiAgentData.response || aiAgentData.message,
        reasoning: `Campaign Day ${campaignContextPayload.campaignDay} - ${messageGoal}`
      };
      
      console.log('AI generated message:', messageContent);
    }

  // Ensure messageContent was assigned
  if (!messageContent || !messageContent.message) {
    console.error('❌ CRITICAL: messageContent validation failed', { messageContent });
    throw new Error('Failed to generate message content');
  }

  console.log('✅ Message content validated, proceeding to schedule + send');
  console.log('🔄 Execution flow check - about to handle test mode or proceed to scheduling');
  console.log('isTestMode:', isTestMode);
  console.log('message_type:', message_type);

    if (isTestMode) {
      // If test mode, save messages to database for persistence
      if (conversation_id) {
        try {
          // Save user message
          await supabase.from('messages').insert({
            conversation_id,
            direction: 'inbound',
            sender: 'customer',
            body: trigger_context.last_customer_message || 'test message',
            status: 'delivered'
          });
          
          // Save AI response with agent-specific sender for tracking
          const senderValue = agent.product_type === 'sales_agent' || agent.product_type === 'lead_nurture' ? 'ai_sales' :
                              agent.product_type === 'customer_service' ? 'ai_cs' :
                              agent.product_type === 'trade_analysis' ? 'ai_sales' :
                              'ai_sales'; // Default to sales
          
          await supabase.from('messages').insert({
            conversation_id,
            direction: 'outbound',
            sender: senderValue,
            body: messageContent.message,
            status: 'sent',
            message_type: 'chat'
          });
          
          console.log('Test messages saved to database');
        } catch (saveError) {
          console.error('Error saving test messages:', saveError);
        }
      }
      
      // In test mode, return the generated message
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
    console.log('═══ INSERTING TO SCHEDULED_MESSAGES ═══');
    console.log('contact_id:', contact_id);
    console.log('agent_id:', agent_id);
    console.log('message_type (original):', originalMessageType);
    console.log('channel:', channel);
    console.log('subject:', messageContent.subject);
    console.log('═══════════════════════════════════════');
    
    // Final validation before insert
    if (!originalMessageType) {
      throw new Error('CRITICAL: message_type became null before database insert');
    }
    
    const { data: scheduledMessage, error: scheduleError } = await supabase
      .from('scheduled_messages')
      .insert({
        contact_id: contact_id,
        agent_id: agent_id,
        message_type: originalMessageType,
        channel: channel,
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

    console.log('Message scheduled:', scheduledMessage.id);

    // Send the message immediately (same flow as product agents)
    console.log('🚀 Starting immediate message send...');

    try {
      // Fetch contact data
      const { data: contact } = await supabase
        .from('contacts')
        .select('full_name, email, phone_number')
        .eq('id', contact_id)
        .single();

      if (!contact) {
        console.error('❌ Contact not found, cannot send message');
        throw new Error('Contact not found');
      }

      console.log(`📞 Contact found: ${contact.full_name}`);

      // Update conversation state
      const { data: convState } = await supabase
        .from('conversation_state')
        .select('messages_sent_today, messages_sent_this_week')
        .eq('contact_id', contact_id)
        .maybeSingle();

      await supabase
        .from('conversation_state')
        .update({
          messages_sent_today: (convState?.messages_sent_today || 0) + 1,
          messages_sent_this_week: (convState?.messages_sent_this_week || 0) + 1,
          last_message_sent_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('contact_id', contact_id);

      console.log('📊 Conversation state updated');

      // Send the message via appropriate channel
      if (channel === 'sms' && contact.phone_number) {
        console.log(`📱 Sending SMS to ${contact.phone_number}...`);
        
        const { error: smsError } = await supabase.functions.invoke('send-sms', {
          body: {
            to: contact.phone_number,
            message: messageContent.message
          }
        });

        if (smsError) {
          console.error('❌ SMS send error:', smsError);
          throw smsError;
        }

        console.log('✅ SMS sent successfully');

        // Save to messages table
        try {
          await supabase
            .from('messages')
            .insert({
              conversation_id,
              direction: 'outbound',
              sender: 'ai_sales',
              body: messageContent.message,
              status: 'sent'
            });
          console.log('💾 Message saved to messages table');
        } catch (dbError) {
          console.error('❌ Failed to save message to database:', dbError);
          // Don't throw - message was already sent successfully
        }

      } else if (channel === 'email' && contact.email) {
        console.log(`📧 Sending email to ${contact.email}...`);
        
        const { error: emailError } = await supabase.functions.invoke('send-email', {
          body: {
            to: contact.email,
            subject: messageContent.subject || 'Message from our team',
            htmlBody: messageContent.message
          }
        });

        if (emailError) {
          console.error('❌ Email send error:', emailError);
          throw emailError;
        }

        console.log('✅ Email sent successfully');

        // Save to messages table
        try {
          await supabase
            .from('messages')
            .insert({
              conversation_id,
              direction: 'outbound',
              sender: 'ai_sales',
              body: messageContent.message,
              status: 'sent'
            });
          console.log('💾 Message saved to messages table');
        } catch (dbError) {
          console.error('❌ Failed to save message to database:', dbError);
          // Don't throw - message was already sent successfully
        }

      } else {
        console.error(`❌ Cannot send: missing ${channel} contact info`);
        throw new Error(`Missing ${channel} contact info`);
      }

      // Mark as sent
      await supabase
        .from('scheduled_messages')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', scheduledMessage.id);

      console.log('✅ Scheduled message marked as sent');

      // Update agent metrics
      if (agent_id) {
        const { data: productAgent } = await supabase
          .from('product_agents')
          .select('messages_sent')
          .eq('id', agent_id)
          .maybeSingle();

        if (productAgent) {
          await supabase
            .from('product_agents')
            .update({
              messages_sent: (productAgent.messages_sent || 0) + 1,
              last_engagement_at: new Date().toISOString()
            })
            .eq('id', agent_id);
          console.log('📈 Product agent metrics updated');
        } else {
          const { data: agentConv } = await supabase
            .from('agent_conversations')
            .select('message_count')
            .eq('id', agent_id)
            .maybeSingle();

          if (agentConv) {
            await supabase
              .from('agent_conversations')
              .update({
                message_count: (agentConv.message_count || 0) + 1,
                last_message_at: new Date().toISOString()
              })
              .eq('id', agent_id);
            console.log('📈 Agent conversation metrics updated');
          }
        }
      }

      // Log activity
      await supabase
        .from('contact_activities')
        .insert({
          contact_id,
          activity_type: channel === 'sms' ? 'sms_sent' : 'email_sent',
          description: `${channel.toUpperCase()} message sent`,
          metadata: {
            scheduled_message_id: scheduledMessage.id,
            agent_id,
            content_preview: messageContent.message.substring(0, 100)
          }
        });

      console.log('✅ Activity logged');
      console.log('🎉 Message sent successfully!');

    } catch (sendError) {
      console.error('❌ Error sending message immediately:', sendError);
      console.error('Full error:', JSON.stringify(sendError));
      
      // Mark as failed but don't throw - let process-scheduled-messages retry
      await supabase
        .from('scheduled_messages')
        .update({
          status: 'failed',
          error_message: sendError instanceof Error ? sendError.message : 'Unknown error',
          updated_at: new Date().toISOString()
        })
        .eq('id', scheduledMessage.id);
      
      console.log('⚠️ Message marked as failed, will be retried by process-scheduled-messages');
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