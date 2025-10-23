import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// This function runs as a cron job every 15 minutes
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('Processing conversation triggers...');

    // Get all active agents
    const { data: agents, error: agentsError } = await supabase
      .from('product_agents')
      .select('*, contacts(*), conversation_state(*)')
      .eq('status', 'active');

    if (agentsError) throw agentsError;

    console.log(`Found ${agents?.length || 0} active agents`);

    const triggersProcessed = [];

    for (const agent of agents || []) {
      const contact = agent.contacts;
      const convState = agent.conversation_state?.[0];

      // Check frequency limits
      const canSendMessage = checkFrequencyLimits(convState);
      if (!canSendMessage) {
        console.log(`Skipping contact ${contact.id} - frequency limit reached`);
        continue;
      }

      // Check various trigger conditions
      const triggers = await evaluateTriggers(agent, contact, convState, supabase);

      for (const trigger of triggers) {
        console.log(`Trigger fired for ${contact.full_name}: ${trigger.type}`);

        // Generate and schedule message
        const { error: messageError } = await supabase.functions.invoke('generate-ai-message', {
          body: {
            contact_id: contact.id,
            agent_id: agent.id,
            message_type: trigger.message_type,
            trigger_context: trigger.context,
            channel: trigger.channel || 'sms'
          }
        });

        if (messageError) {
          console.error(`Error generating message for trigger:`, messageError);
        } else {
          triggersProcessed.push({
            contact_id: contact.id,
            trigger_type: trigger.type,
            agent_type: agent.product_type
          });
        }
      }
    }

    // Auto-expire old agents
    await supabase.rpc('expire_old_agents');

    // Reset daily counters if needed (at midnight)
    const hour = new Date().getHours();
    if (hour === 0) {
      await supabase.rpc('reset_daily_message_counters');
    }

    // Reset weekly counters if needed (Monday at midnight)
    const day = new Date().getDay();
    if (day === 1 && hour === 0) {
      await supabase.rpc('reset_weekly_message_counters');
    }

    console.log(`Processed ${triggersProcessed.length} triggers`);

    return new Response(
      JSON.stringify({
        success: true,
        triggers_processed: triggersProcessed.length,
        details: triggersProcessed
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );
  } catch (error) {
    console.error('Error in process-conversation-triggers:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});

function checkFrequencyLimits(convState: any): boolean {
  if (!convState) return true;

  // Max 2 messages per day
  if (convState.messages_sent_today >= 2) return false;

  // Max 5 messages per week
  if (convState.messages_sent_this_week >= 5) return false;

  // Min 12 hours between messages
  if (convState.last_message_sent_at) {
    const hoursSinceLastMessage = (Date.now() - new Date(convState.last_message_sent_at).getTime()) / (1000 * 60 * 60);
    if (hoursSinceLastMessage < 12) return false;
  }

  // Check waiting_until
  if (convState.waiting_until && new Date(convState.waiting_until) > new Date()) {
    return false;
  }

  return true;
}

async function evaluateTriggers(agent: any, contact: any, convState: any, supabase: any) {
  const triggers = [];
  const now = new Date();
  const daysSinceAssigned = Math.floor((now.getTime() - new Date(agent.assigned_date).getTime()) / (1000 * 60 * 60 * 24));

  // TRIGGER 1: No engagement for 7 days
  if (convState?.last_engagement_at) {
    const daysSinceEngagement = Math.floor((now.getTime() - new Date(convState.last_engagement_at).getTime()) / (1000 * 60 * 60 * 24));
    if (daysSinceEngagement >= 7 && daysSinceEngagement < 8) {
      triggers.push({
        type: 'no_engagement_7_days',
        message_type: 'check_in',
        context: { days_since_engagement: daysSinceEngagement },
        channel: 'sms'
      });
    }
  }

  // TRIGGER 2: Day 1 check-in (24 hours after assignment)
  if (daysSinceAssigned === 1 && agent.messages_sent === 1) {
    triggers.push({
      type: 'day_1_checkin',
      message_type: 'check_in',
      context: { days_since_assigned: daysSinceAssigned },
      channel: 'sms'
    });
  }

  // TRIGGER 3: Week 1 progress check (7 days)
  if (daysSinceAssigned === 7) {
    triggers.push({
      type: 'week_1_progress',
      message_type: 'check_in',
      context: { days_since_assigned: daysSinceAssigned },
      channel: 'sms'
    });
  }

  // TRIGGER 4: Agent expiration warning (5 days before)
  const daysUntilExpiration = Math.floor((new Date(agent.expiration_date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (daysUntilExpiration === 5) {
    triggers.push({
      type: 'expiration_warning',
      message_type: 'expiration_notice',
      context: { days_until_expiration: daysUntilExpiration },
      channel: 'sms'
    });
  }

  // TRIGGER 5: High engagement, no purchase (upsell opportunity)
  if (contact.engagement_score >= 60 && contact.total_spent === 0 && daysSinceAssigned >= 7) {
    // Check if we haven't sent an upsell message recently
    const { data: recentUpsells } = await supabase
      .from('scheduled_messages')
      .select('*')
      .eq('contact_id', contact.id)
      .eq('message_type', 'upsell')
      .gte('created_at', new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString());

    if (!recentUpsells || recentUpsells.length === 0) {
      triggers.push({
        type: 'high_engagement_upsell',
        message_type: 'upsell',
        context: { 
          engagement_score: contact.engagement_score,
          days_since_assigned: daysSinceAssigned
        },
        channel: 'sms'
      });
    }
  }

  // TRIGGER 6: Product-specific triggers
  if (agent.product_type === 'algo_monthly') {
    // Check for no logins in 7 days (churn risk)
    const { data: recentActivities } = await supabase
      .from('contact_activities')
      .select('*')
      .eq('contact_id', contact.id)
      .eq('activity_type', 'login')
      .gte('created_at', new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString());

    if ((!recentActivities || recentActivities.length === 0) && daysSinceAssigned >= 7) {
      triggers.push({
        type: 'algo_no_login_churn_risk',
        message_type: 'retention',
        context: { days_since_login: 7 },
        channel: 'sms'
      });
    }
  }

  return triggers;
}