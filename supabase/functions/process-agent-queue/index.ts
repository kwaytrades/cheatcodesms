import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
  influencer_outreach: 3,
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

    console.log('Processing agent queues...');

    // Find all conversation states with queued agents
    const { data: states, error: statesError } = await supabase
      .from('conversation_state')
      .select('*, product_agents!conversation_state_active_agent_id_fkey(*)')
      .not('agent_queue', 'eq', '[]');

    if (statesError) throw statesError;

    let processed = 0;
    let dequeued = 0;

    for (const state of states || []) {
      const activeAgent = state.product_agents;
      
      // Check if active agent is stale (no message in 48 hours)
      const hoursSinceLastMessage = state.last_message_sent_at
        ? (Date.now() - new Date(state.last_message_sent_at).getTime()) / (1000 * 60 * 60)
        : 999;

      if (hoursSinceLastMessage >= 48 || !activeAgent) {
        console.log(`Agent queue ready for contact ${state.contact_id}`);
        
        // Get next agent from queue
        const queue = state.agent_queue as any[];
        if (queue.length === 0) continue;

        const nextInQueue = queue[0];
        const remainingQueue = queue.slice(1);

        // Get agent details
        const { data: nextAgent } = await supabase
          .from('product_agents')
          .select('*')
          .eq('id', nextInQueue.agent_id)
          .single();

        if (!nextAgent) continue;

        const newPriority = AGENT_PRIORITIES[nextAgent.product_type as keyof typeof AGENT_PRIORITIES] || 1;

        // Update conversation state
        const { error: updateError } = await supabase
          .from('conversation_state')
          .update({
            active_agent_id: nextInQueue.agent_id,
            agent_priority: newPriority,
            agent_queue: remainingQueue,
          })
          .eq('id', state.id);

        if (updateError) {
          console.error('Failed to update conversation state:', updateError);
          continue;
        }

        // Trigger the queued message
        const { error: messageError } = await supabase.functions.invoke('generate-ai-message', {
          body: {
            contact_id: state.contact_id,
            agent_id: nextInQueue.agent_id,
            message_type: nextInQueue.message_type,
            trigger_context: { dequeued: true },
          },
        });

        if (messageError) {
          console.error('Failed to send queued message:', messageError);
        } else {
          dequeued++;
        }
      }

      processed++;
    }

    console.log(`Processed ${processed} queues, dequeued ${dequeued} agents`);

    return new Response(
      JSON.stringify({
        success: true,
        processed,
        dequeued,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in process-agent-queue:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
