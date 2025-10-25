import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AssignAgentRequest {
  contact_id: string;
  product_type: 'webinar' | 'textbook' | 'flashcards' | 'algo_monthly' | 'ccta' | 'lead_nurture';
  product_id?: string;
  agent_context: Record<string, any>; // Form responses, goals, challenges
  days_active?: number; // Default 60
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

    const { 
      contact_id, 
      product_type, 
      product_id,
      agent_context,
      days_active = 60 
    }: AssignAgentRequest = await req.json();

    console.log(`Assigning ${product_type} agent to contact ${contact_id}`);

    // Calculate expiration date
    const assigned_date = new Date();
    const expiration_date = new Date(assigned_date);
    expiration_date.setDate(expiration_date.getDate() + days_active);

    // Create product agent record
    const { data: agent, error: agentError } = await supabase
      .from('product_agents')
      .insert({
        contact_id,
        product_type,
        product_id,
        agent_context,
        assigned_date: assigned_date.toISOString(),
        expiration_date: expiration_date.toISOString(),
        status: 'active'
      })
      .select()
      .single();

    if (agentError) throw agentError;

    console.log(`Agent assigned: ${agent.id}`);

    // Define agent priorities (normal mode - no /help)
    const AGENT_PRIORITIES_NORMAL = {
      sales_agent: 10,
      webinar: 6,        // Highest product agent
      textbook: 5,
      flashcards: 4,
      algo_monthly: 4,
      ccta: 4,
      lead_nurture: 3,
      customer_service: 2  // Lowest in normal mode
    };

    // Help mode priorities (when /help command is active)
    const HELP_MODE_PRIORITIES = {
      customer_service: 10,  // Highest in help mode
      lead_nurture: 9,
      webinar: 6,
      textbook: 5,
      flashcards: 4,
      algo_monthly: 4,
      ccta: 4,
      sales_agent: 2  // Lowest in help mode
    };

    // Check if contact is in help mode
    const { data: helpModeCheck } = await supabase
      .from('conversation_state')
      .select('help_mode_until')
      .eq('contact_id', contact_id)
      .maybeSingle();

    const isHelpMode = helpModeCheck?.help_mode_until && 
      new Date(helpModeCheck.help_mode_until) > new Date();

    // Calculate priority based on mode
    const agentPriority = isHelpMode
      ? (HELP_MODE_PRIORITIES[product_type as keyof typeof HELP_MODE_PRIORITIES] || 1)
      : (AGENT_PRIORITIES_NORMAL[product_type as keyof typeof AGENT_PRIORITIES_NORMAL] || 1);

    console.log(`Setting active agent with priority ${agentPriority}`);

    // Check if conversation state exists
    const { data: existingState } = await supabase
      .from('conversation_state')
      .select('id')
      .eq('contact_id', contact_id)
      .maybeSingle();

    if (existingState) {
      // UPDATE existing record (force override)
      const { error: stateError } = await supabase
        .from('conversation_state')
        .update({
          active_agent_id: agent.id,
          agent_priority: agentPriority,
          last_message_sent_at: null,
          messages_sent_today: 0,
          messages_sent_this_week: 0,
          current_conversation_phase: 'onboarding',
          waiting_for_reply: false,
          last_engagement_at: new Date().toISOString(),
          help_mode_until: null  // Clear any help mode override
        })
        .eq('contact_id', contact_id);

      if (stateError) {
        console.error('Error updating conversation state:', stateError);
      } else {
        console.log('✅ Conversation state UPDATED with new active agent');
      }
    } else {
      // INSERT new record
      const { error: stateError } = await supabase
        .from('conversation_state')
        .insert({
          contact_id,
          active_agent_id: agent.id,
          agent_priority: agentPriority,
          last_message_sent_at: null,
          messages_sent_today: 0,
          messages_sent_this_week: 0,
          current_conversation_phase: 'onboarding',
          waiting_for_reply: false,
          last_engagement_at: new Date().toISOString()
        });

      if (stateError) {
        console.error('Error creating conversation state:', stateError);
      } else {
        console.log('✅ Conversation state CREATED with new active agent');
      }
    }

    // Load contact data for first message
    const { data: contact, error: contactError } = await supabase
      .from('contacts')
      .select('*')
      .eq('id', contact_id)
      .single();

    if (contactError) throw contactError;

    // Create or get conversation for message tracking
    let conversation_id = null;

    const { data: existingConv } = await supabase
      .from('conversations')
      .select('id')
      .eq('contact_id', contact_id)
      .maybeSingle();

    if (existingConv) {
      conversation_id = existingConv.id;
      console.log(`Using existing conversation: ${conversation_id}`);
    } else {
      const { data: newConv, error: convError } = await supabase
        .from('conversations')
        .insert({
          contact_id,
          phone_number: contact.phone_number,
          contact_name: contact.full_name,
          assigned_agent: 'sales_ai',
          status: 'active'
        })
        .select('id')
        .single();

      if (convError) {
        console.error('Error creating conversation:', convError);
      } else {
        conversation_id = newConv.id;
        console.log(`Created new conversation: ${conversation_id}`);
      }
    }

    // Generate first message immediately
    console.log('Generating first message...');
    const { data: messageData, error: messageError } = await supabase.functions.invoke(
      'generate-ai-message',
      {
        body: {
          contact_id,
          agent_id: agent.id,
          conversation_id,  // ✅ Pass conversation_id for message tracking
          message_type: 'introduction',
          trigger_context: {
            event: 'agent_assigned',
            product_type,
            agent_context
          }
        }
      }
    );

    if (messageError) {
      console.error('Error generating message:', messageError);
      console.error('Message error details:', JSON.stringify(messageError));
    } else {
      console.log('✅ First message generated');
      console.log('Message data:', JSON.stringify(messageData));
      
      // Note: generate-ai-message already sends the message immediately
      // No need to call send-scheduled-message again here
      if (messageData?.scheduled_message_id) {
        console.log(`✅ Welcome message scheduled and sent (ID: ${messageData.scheduled_message_id})`);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        agent,
        message: 'Agent assigned and first message scheduled'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );
  } catch (error) {
    console.error('Error in assign-product-agent:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});