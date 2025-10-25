import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SendMessageRequest {
  scheduled_message_id: string;
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

    const { scheduled_message_id }: SendMessageRequest = await req.json();

    console.log(`Sending scheduled message: ${scheduled_message_id}`);

    // Load the scheduled message
    const { data: message, error: messageError } = await supabase
      .from('scheduled_messages')
      .select('*, product_agents(*), contacts(*)')
      .eq('id', scheduled_message_id)
      .single();

    if (messageError) throw messageError;

    if (message.status !== 'pending') {
      throw new Error(`Message already sent or cancelled: ${message.status}`);
    }

    // Update conversation state - Get current values first, then increment
    const { data: currentState } = await supabase
      .from('conversation_state')
      .select('messages_sent_today, messages_sent_this_week')
      .eq('contact_id', message.contact_id)
      .single();

    const { error: stateError } = await supabase
      .from('conversation_state')
      .update({
        last_message_sent_at: new Date().toISOString(),
        messages_sent_today: (currentState?.messages_sent_today || 0) + 1,
        messages_sent_this_week: (currentState?.messages_sent_this_week || 0) + 1
      })
      .eq('contact_id', message.contact_id);

    // Send via appropriate channel
    if (message.channel === 'sms') {
      // Send SMS via Twilio
      const { error: smsError } = await supabase.functions.invoke('send-sms', {
        body: {
          to: message.contacts.phone_number,
          message: message.message_body
        }
      });

      if (smsError) throw smsError;
    } else if (message.channel === 'email') {
      // Send email via SES
      const { error: emailError } = await supabase.functions.invoke('send-email', {
        body: {
          to: message.contacts.email,
          subject: message.subject,
          body: message.message_body
        }
      });

      if (emailError) throw emailError;
    }

    // Save message to messages table for conversation tracking
    if (message.channel === 'sms') {
      const { data: conv } = await supabase
        .from('conversations')
        .select('id')
        .eq('contact_id', message.contact_id)
        .maybeSingle();

      if (conv) {
        const { error: msgError } = await supabase
          .from('messages')
          .insert({
            conversation_id: conv.id,
            sender: 'ai',
            direction: 'outbound',
            body: message.message_body,
            status: 'sent'
          });

        if (msgError) {
          console.error('Error saving message to messages table:', msgError);
        } else {
          console.log('✅ Message saved to messages table');
        }
      }
    }

    // Update message status to sent
    const { error: updateError } = await supabase
      .from('scheduled_messages')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString()
      })
      .eq('id', scheduled_message_id);

    if (updateError) throw updateError;

    // Update agent metrics
    const { data: currentAgent } = await supabase
      .from('product_agents')
      .select('messages_sent')
      .eq('id', message.agent_id)
      .single();

    await supabase
      .from('product_agents')
      .update({
        messages_sent: (currentAgent?.messages_sent || 0) + 1
      })
      .eq('id', message.agent_id);

    // Log activity
    await supabase
      .from('contact_activities')
      .insert({
        contact_id: message.contact_id,
        activity_type: message.channel === 'sms' ? 'sms_sent' : 'email_sent',
        description: `Sent ${message.message_type} message via ${message.channel}`,
        metadata: {
          message_id: scheduled_message_id,
          agent_id: message.agent_id
        }
      });

    console.log(`Message sent successfully: ${scheduled_message_id}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Message sent successfully'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );
  } catch (error) {
    console.error('Error in send-scheduled-message:', error);

    // Mark message as failed
    try {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );
      
      const { scheduled_message_id } = await req.json();
      
      const { data: currentMsg } = await supabase
        .from('scheduled_messages')
        .select('retry_count')
        .eq('id', scheduled_message_id)
        .single();

      await supabase
        .from('scheduled_messages')
        .update({
          status: 'failed',
          error_message: error instanceof Error ? error.message : 'Unknown error',
          retry_count: (currentMsg?.retry_count || 0) + 1
        })
        .eq('id', scheduled_message_id);
    } catch (updateError) {
      console.error('Failed to update message status:', updateError);
    }

    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});