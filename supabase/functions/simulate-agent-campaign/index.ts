import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { agent_type, mock_customer } = await req.json();

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get campaign config for agent type
    const { data: agentConfig, error: configError } = await supabase
      .from('agent_type_configs')
      .select('campaign_config')
      .eq('agent_type', agent_type)
      .single();

    if (configError || !agentConfig?.campaign_config) {
      throw new Error(`No campaign config found for ${agent_type}`);
    }

    const campaignConfig = agentConfig.campaign_config as any;
    const scheduledOutreach = campaignConfig.outreach_schedule || [];

    // Create temporary test context
    const testContactId = `test_${Date.now()}`;
    const testAgentId = `test_agent_${Date.now()}`;
    
    const mockContact = {
      id: testContactId,
      name: mock_customer?.name || 'Test Customer',
      personality_type: mock_customer?.personality_type || 'analytical',
      email: 'test@example.com',
      phone: '+15555555555',
      tags: [agent_type],
      customer_goals: mock_customer?.goals || 'Learn and engage with product'
    };

    const campaignPreview = [];

    // Sort scheduled outreach by day
    const sortedOutreach = [...scheduledOutreach].sort((a, b) => a.day - b.day);

    // Simulate each scheduled message
    for (const outreach of sortedOutreach) {
      console.log(`Simulating day ${outreach.day} - ${outreach.message_type}`);

      // Build campaign context for this day
      const campaignDay = outreach.day;
      const daysRemaining = (campaignConfig.duration_days || 90) - campaignDay;

      // Simulate conversation context (messages get more contextual as days progress)
      const hasRecentConversation = campaignDay > 1 && Math.random() > 0.5;
      const recentConversation = hasRecentConversation ? {
        hours_since_last_engagement: campaignDay > 7 ? 48 : 12,
        hours_since_last_message: campaignDay > 7 ? 72 : 18,
        last_topic: `Previous discussion about ${agent_type} progress`,
        recent_messages_summary: `Customer asked about progress | Agent: provided guidance`,
        was_recent_conversation: campaignDay > 7,
        was_very_recent: campaignDay <= 7
      } : null;

      // Call generate-ai-message in test mode
      const { data: messageData, error: messageError } = await supabase.functions.invoke(
        'generate-ai-message',
        {
          body: {
            contact_id: testContactId,
            agent_id: testAgentId,
            agent_type: agent_type,
            trigger_type: outreach.message_type,
            trigger_context: {
              campaign_day: campaignDay,
              days_remaining: daysRemaining,
              trigger_type: 'scheduled_outreach',
              message_goal: outreach.message_goal,
              message_channel: outreach.channel,
              recent_conversation: recentConversation
            },
            channel: outreach.channel,
            test_mode: true,
            mock_contact: mockContact
          }
        }
      );

      if (messageError) {
        console.error(`Error generating message for day ${campaignDay}:`, messageError);
        continue;
      }

      const generatedMessage = messageData?.message || 'Failed to generate';

      // Simulate customer response based on personality and engagement
      let simulatedCustomerReply = null;
      if (mock_customer?.engagement_level !== 'low' && Math.random() > 0.3) {
        const replyTypes = {
          analytical: ['That makes sense. Can you provide more details?', 'Interesting. What\'s the data behind this?'],
          relationship_builder: ['Thanks for checking in! I appreciate it.', 'This is helpful, thank you!'],
          results_driven: ['Got it. What\'s the next step?', 'Understood. Let\'s move forward.'],
          creative: ['Love this approach! Tell me more.', 'This is exciting! What else?']
        };
        
        const personality = mock_customer?.personality_type || 'analytical';
        const replies = replyTypes[personality as keyof typeof replyTypes] || replyTypes.analytical;
        simulatedCustomerReply = replies[Math.floor(Math.random() * replies.length)];
      }

      campaignPreview.push({
        day: campaignDay,
        trigger_type: outreach.message_type,
        message_goal: outreach.message_goal,
        channel: outreach.channel,
        message_generated: generatedMessage,
        simulated_customer_reply: simulatedCustomerReply,
        had_recent_conversation: hasRecentConversation,
        conversation_aware: !!recentConversation
      });
    }

    // Calculate statistics
    const totalMessages = campaignPreview.length;
    const avgMessageLength = campaignPreview.reduce(
      (sum, msg) => sum + (msg.message_generated?.length || 0), 
      0
    ) / totalMessages;

    const responseRate = campaignPreview.filter(m => m.simulated_customer_reply).length / totalMessages;

    return new Response(
      JSON.stringify({
        agent_type,
        mock_customer: mockContact,
        campaign_duration: campaignConfig.duration_days,
        campaign_preview: campaignPreview,
        statistics: {
          total_messages: totalMessages,
          avg_message_length: Math.round(avgMessageLength),
          simulated_response_rate: Math.round(responseRate * 100),
          conversation_aware_messages: campaignPreview.filter(m => m.conversation_aware).length
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('Error in simulate-agent-campaign:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
