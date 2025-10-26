import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ActivateHelpModeRequest {
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

    const { contact_id }: ActivateHelpModeRequest = await req.json();

    if (!contact_id) {
      throw new Error('contact_id is required');
    }

    console.log(`Activating help mode for contact: ${contact_id}`);

    // Set help mode for 4 hours
    const helpModeUntil = new Date(Date.now() + 4 * 60 * 60 * 1000);

    // Update conversation state with help mode
    const { error: updateError } = await supabase
      .from('conversation_state')
      .update({
        help_mode_until: helpModeUntil.toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('contact_id', contact_id);

    if (updateError) {
      console.error('Error setting help mode:', updateError);
      throw updateError;
    }

    console.log(`✅ Help mode activated until: ${helpModeUntil.toISOString()}`);

    // Recalculate active agent (customer_service will get priority 10 in help mode)
    const { error: recalcError } = await supabase.rpc('recalculate_active_agent', {
      p_contact_id: contact_id
    });

    if (recalcError) {
      console.error('Error recalculating active agent:', recalcError);
      throw recalcError;
    }

    console.log('✅ Active agent recalculated - customer_service should be active');

    // Fetch the active agent to confirm
    const { data: convState } = await supabase
      .from('conversation_state')
      .select(`
        active_agent_id, 
        agent_priority, 
        product_agents:active_agent_id(product_type)
      `)
      .eq('contact_id', contact_id)
      .single();

    const activeAgentType = Array.isArray(convState?.product_agents) 
      ? convState.product_agents[0]?.product_type 
      : (convState?.product_agents as any)?.product_type;

    return new Response(
      JSON.stringify({
        success: true,
        help_mode_until: helpModeUntil.toISOString(),
        active_agent: activeAgentType || 'unknown',
        message: 'Help mode activated. Customer service agent is now prioritized.'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );
  } catch (error) {
    console.error('Error in activate-help-mode:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
