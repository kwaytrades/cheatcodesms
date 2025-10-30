import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Processing scheduled messages...');

    // Fetch all pending messages that are due to be sent
    const { data: pendingMessages, error: fetchError } = await supabase
      .from('scheduled_messages')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_for', new Date().toISOString())
      .order('scheduled_for', { ascending: true })
      .limit(100);

    if (fetchError) {
      console.error('Error fetching pending messages:', fetchError);
      throw fetchError;
    }

    if (!pendingMessages || pendingMessages.length === 0) {
      console.log('No pending messages to process');
      return new Response(
        JSON.stringify({ success: true, processed: 0, message: 'No pending messages' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${pendingMessages.length} pending messages to process`);

    let successCount = 0;
    let failureCount = 0;

    // Process each message
    for (const message of pendingMessages) {
      try {
        console.log(`Processing message ${message.id} for contact ${message.contact_id}`);

        // Fetch contact data
        const { data: contact, error: contactError } = await supabase
          .from('contacts')
          .select('full_name, email, phone_number')
          .eq('id', message.contact_id)
          .single();

        if (contactError || !contact) {
          console.error(`Error fetching contact ${message.contact_id}:`, contactError);
          throw new Error('Contact not found');
        }

        // Update conversation state (increment message counters)
        const { error: stateError } = await supabase
          .from('conversation_state')
          .update({
            messages_sent_today: supabase.rpc('increment', { x: 1 }),
            messages_sent_this_week: supabase.rpc('increment', { x: 1 }),
            last_agent_message_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('contact_id', message.contact_id);

        if (stateError) {
          console.error('Error updating conversation state:', stateError);
        }

        // Send the message via appropriate channel
        let sendSuccess = false;
        let sendError = null;

        if (message.channel === 'sms' && contact.phone_number) {
          console.log(`Sending SMS to ${contact.phone_number}`);
          const { error: smsError } = await supabase.functions.invoke('send-sms', {
            body: {
              to: contact.phone_number,
              message: message.content
            }
          });
          
          if (smsError) {
            console.error('SMS send error:', smsError);
            sendError = smsError;
          } else {
            sendSuccess = true;
            console.log('SMS sent successfully');

            // Save to messages table for conversation tracking
            const { error: msgError } = await supabase
              .from('messages')
              .insert({
                contact_id: message.contact_id,
                conversation_id: message.conversation_id,
                message_type: 'outbound',
                content: message.content,
                channel: 'sms',
                sent_at: new Date().toISOString(),
                status: 'sent'
              });

            if (msgError) {
              console.error('Error saving to messages table:', msgError);
            }
          }
        } else if (message.channel === 'email' && contact.email) {
          console.log(`Sending email to ${contact.email}`);
          const { error: emailError } = await supabase.functions.invoke('send-email', {
            body: {
              to: contact.email,
              subject: message.subject || 'Message from our team',
              htmlBody: message.content
            }
          });

          if (emailError) {
            console.error('Email send error:', emailError);
            sendError = emailError;
          } else {
            sendSuccess = true;
            console.log('Email sent successfully');
          }
        } else {
          console.error(`Cannot send message: missing contact info for channel ${message.channel}`);
          sendError = new Error(`Missing ${message.channel} contact info`);
        }

        if (sendSuccess) {
          // Mark message as sent
          const { error: updateError } = await supabase
            .from('scheduled_messages')
            .update({
              status: 'sent',
              sent_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq('id', message.id);

          if (updateError) {
            console.error('Error updating scheduled message status:', updateError);
          }

          // Update agent metrics
          if (message.agent_id) {
            // Check if it's a product agent or agent conversation
            const { data: productAgent } = await supabase
              .from('product_agents')
              .select('id')
              .eq('id', message.agent_id)
              .single();

            if (productAgent) {
              // Update product_agents
              const { error: agentError } = await supabase
                .from('product_agents')
                .update({
                  messages_sent: supabase.rpc('increment', { x: 1 }),
                  last_engagement_at: new Date().toISOString(),
                  updated_at: new Date().toISOString()
                })
                .eq('id', message.agent_id);

              if (agentError) {
                console.error('Error updating product agent metrics:', agentError);
              }
            } else {
              // Update agent_conversations
              const { error: convError } = await supabase
                .from('agent_conversations')
                .update({
                  message_count: supabase.rpc('increment', { x: 1 }),
                  last_message_at: new Date().toISOString(),
                  updated_at: new Date().toISOString()
                })
                .eq('id', message.agent_id);

              if (convError) {
                console.error('Error updating agent conversation metrics:', convError);
              }
            }
          }

          // Log activity
          const { error: activityError } = await supabase
            .from('contact_activities')
            .insert({
              contact_id: message.contact_id,
              activity_type: message.channel === 'sms' ? 'sms_sent' : 'email_sent',
              description: `${message.channel.toUpperCase()} message sent`,
              metadata: {
                message_id: message.id,
                agent_id: message.agent_id,
                content_preview: message.content.substring(0, 100)
              }
            });

          if (activityError) {
            console.error('Error logging activity:', activityError);
          }

          successCount++;
          console.log(`✓ Successfully processed message ${message.id}`);
        } else {
          // Mark as failed
          const { error: failError } = await supabase
            .from('scheduled_messages')
            .update({
              status: 'failed',
              retry_count: (message.retry_count || 0) + 1,
              error_message: sendError?.message || 'Unknown error',
              updated_at: new Date().toISOString()
            })
            .eq('id', message.id);

          if (failError) {
            console.error('Error marking message as failed:', failError);
          }

          failureCount++;
          console.log(`✗ Failed to process message ${message.id}: ${sendError?.message}`);
        }
      } catch (error: any) {
        console.error(`Error processing message ${message.id}:`, error);
        
        // Mark as failed with retry
        const { error: failError } = await supabase
          .from('scheduled_messages')
          .update({
            status: 'failed',
            retry_count: (message.retry_count || 0) + 1,
            error_message: error?.message || 'Unknown error',
            updated_at: new Date().toISOString()
          })
          .eq('id', message.id);

        if (failError) {
          console.error('Error marking message as failed:', failError);
        }

        failureCount++;
      }
    }

    console.log(`Processing complete: ${successCount} sent, ${failureCount} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        processed: pendingMessages.length,
        sent: successCount,
        failed: failureCount
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in process-scheduled-messages:', error);
    return new Response(
      JSON.stringify({ error: error?.message || 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
