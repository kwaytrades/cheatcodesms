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

    // Initialize conversation state if it doesn't exist
    const { error: stateError } = await supabase
      .from('conversation_state')
      .upsert({
        contact_id,
        last_message_sent_at: null,
        messages_sent_today: 0,
        messages_sent_this_week: 0,
        current_conversation_phase: 'onboarding',
        waiting_for_reply: false
      }, { 
        onConflict: 'contact_id',
        ignoreDuplicates: true 
      });

    if (stateError && stateError.code !== '23505') { // Ignore duplicate key errors
      console.error('Error initializing conversation state:', stateError);
    }

    // Load contact data for first message
    const { data: contact, error: contactError } = await supabase
      .from('contacts')
      .select('*')
      .eq('id', contact_id)
      .single();

    if (contactError) throw contactError;

    // Generate first message immediately
    console.log('Generating first message...');
    const { data: messageData, error: messageError } = await supabase.functions.invoke(
      'generate-ai-message',
      {
        body: {
          contact_id,
          agent_id: agent.id,
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
    } else {
      console.log('First message generated and scheduled');
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