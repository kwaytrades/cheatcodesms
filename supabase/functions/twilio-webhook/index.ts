import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse incoming Twilio webhook data
    const formData = await req.formData();
    const from = formData.get('From')?.toString() || '';
    const body = formData.get('Body')?.toString() || '';
    const messageSid = formData.get('MessageSid')?.toString() || '';

    console.log('Incoming SMS:', { from, body, messageSid });

    // Check for opt-out keywords
    const optOutKeywords = ['STOP', 'UNSUBSCRIBE', 'OPT OUT', 'OPTOUT'];
    const isOptOut = optOutKeywords.some(keyword => 
      body.toUpperCase().includes(keyword)
    );

    // Find existing contact by phone number
    const { data: existingContact } = await supabase
      .from('contacts')
      .select('*')
      .eq('phone_number', from)
      .maybeSingle();

    // Find or create conversation
    let { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('*')
      .eq('phone_number', from)
      .maybeSingle();

    if (!conversation) {
      const { data: newConv, error: createError } = await supabase
        .from('conversations')
        .insert({
          phone_number: from,
          contact_id: existingContact?.id || null,
          contact_name: existingContact?.full_name || null,
          status: isOptOut ? 'opted_out' : 'active',
          last_message_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (createError) throw createError;
      conversation = newConv;
    } else {
      // Update conversation with contact info if we found one
      const updates: any = {
        last_message_at: new Date().toISOString()
      };
      
      if (existingContact && !conversation.contact_id) {
        updates.contact_id = existingContact.id;
        updates.contact_name = existingContact.full_name;
      }
      
      if (isOptOut) {
        updates.status = 'opted_out';
      }
      
      await supabase
        .from('conversations')
        .update(updates)
        .eq('id', conversation.id);
    }

    // Store incoming message
    await supabase.from('messages').insert({
      conversation_id: conversation.id,
      direction: 'inbound',
      sender: 'customer',
      body: body,
      twilio_message_sid: messageSid,
      status: 'delivered',
    });

    // Check if this phone number was part of any campaigns and increment reply count
    const { data: campaignMessages } = await supabase
      .from('campaign_messages')
      .select('campaign_id')
      .eq('phone_number', from)
      .eq('status', 'sent')
      .limit(1);

    if (campaignMessages && campaignMessages.length > 0) {
      // Increment the campaign's reply_count
      const campaignId = campaignMessages[0].campaign_id;
      
      const { data: currentCampaign } = await supabase
        .from('campaigns')
        .select('reply_count')
        .eq('id', campaignId)
        .single();

      if (currentCampaign) {
        await supabase
          .from('campaigns')
          .update({ reply_count: (currentCampaign.reply_count || 0) + 1 })
          .eq('id', campaignId);
        
        console.log(`Incremented reply count for campaign ${campaignId}`);
      }
    }

    // Update conversation last_message_at
    await supabase
      .from('conversations')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', conversation.id);

    if (isOptOut) {
      // Send opt-out confirmation
      return new Response(
        `<?xml version="1.0" encoding="UTF-8"?>
        <Response>
          <Message>You have been unsubscribed. Reply START to opt back in.</Message>
        </Response>`,
        { 
          headers: { ...corsHeaders, 'Content-Type': 'text/xml' },
          status: 200,
        }
      );
    }

    // Get conversation history for AI context
    const { data: recentMessages } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversation.id)
      .order('created_at', { ascending: false })
      .limit(10);

    // Determine which AI agent to use based on conversation status
    const agentType = conversation.assigned_agent || 'sales_ai';
    
    // Map agent_type to message_sender enum
    const messageSender = agentType === 'sales_ai' ? 'ai_sales' : 
                          agentType === 'cs_ai' ? 'ai_cs' : 'human_team';

    // Call AI agent to generate response
    const aiResponse = await fetch(`${supabaseUrl}/functions/v1/ai-agent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({
        conversationId: conversation.id,
        agentType: agentType,
        incomingMessage: body,
        history: recentMessages?.reverse() || [],
      }),
    });

    const { response: aiMessage, needsHandoff } = await aiResponse.json();

    if (needsHandoff) {
      // Mark conversation for human review
      await supabase
        .from('conversations')
        .update({ status: 'needs_human' })
        .eq('id', conversation.id);

      // Store AI message indicating handoff
      await supabase.from('messages').insert({
        conversation_id: conversation.id,
        direction: 'outbound',
        sender: messageSender,
        body: "Thanks for your message. A team member will get back to you shortly.",
        status: 'sent',
      });

      return new Response(
        `<?xml version="1.0" encoding="UTF-8"?>
        <Response>
          <Message>Thanks for your message. A team member will get back to you shortly.</Message>
        </Response>`,
        { 
          headers: { ...corsHeaders, 'Content-Type': 'text/xml' },
          status: 200,
        }
      );
    }

    // Store AI response in database
    await supabase.from('messages').insert({
      conversation_id: conversation.id,
      direction: 'outbound',
      sender: messageSender,
      body: aiMessage,
      status: 'sent',
    });

    // Send AI response via Twilio
    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?>
      <Response>
        <Message>${aiMessage}</Message>
      </Response>`,
      { 
        headers: { ...corsHeaders, 'Content-Type': 'text/xml' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Twilio webhook error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
