import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.1";
import { getAgentExpirationDate } from "../_shared/agent-utils.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { campaign_id } = await req.json();

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get campaign
    const { data: campaign, error: campaignError } = await supabase
      .from('ai_sales_campaigns')
      .select('*')
      .eq('id', campaign_id)
      .single();

    if (campaignError || !campaign) {
      throw new Error('Campaign not found');
    }

    // Validate that sales campaigns only use sales_agent type
    if (campaign.agent_type !== 'sales_agent') {
      console.error(`Invalid agent type for sales campaign: ${campaign.agent_type}`);
      throw new Error('Sales campaigns can only use sales_agent type');
    }

    // Get all pending contacts in campaign
    let { data: campaignContacts, error: contactsError } = await supabase
      .from('ai_sales_campaign_contacts')
      .select('*, contacts(*)')
      .eq('campaign_id', campaign_id)
      .in('status', ['pending', 'active']);

    if (contactsError) {
      throw contactsError;
    }

    // Safety check: If no contacts exist, populate them from audience_filter
    if (!campaignContacts || campaignContacts.length === 0) {
      console.log('No contacts found, populating from audience_filter...');
      
      if (campaign.audience_filter && Array.isArray(campaign.audience_filter)) {
        // Clean filters by removing id field
        const filters = campaign.audience_filter.map((filter: any) => {
          const { id, ...rest } = filter;
          return rest;
        });

        // Invoke filter-contacts to get matching contacts
        const filterResponse = await fetch(`${supabaseUrl}/functions/v1/filter-contacts`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ filters, limit: 10000 })
        });

        if (filterResponse.ok) {
          const filterData = await filterResponse.json();
          
          if (filterData.contacts && filterData.contacts.length > 0) {
            const contactsToInsert = filterData.contacts.map((contact: any) => ({
              campaign_id: campaign_id,
              contact_id: contact.id,
              status: 'pending'
            }));

            const { error: insertError } = await supabase
              .from('ai_sales_campaign_contacts')
              .insert(contactsToInsert);

            if (insertError) {
              console.error('Error inserting campaign contacts:', insertError);
            } else {
              // Update contact count
              await supabase
                .from('ai_sales_campaigns')
                .update({ contact_count: filterData.total })
                .eq('id', campaign_id);

              // Refetch campaign contacts
              const { data: newContacts } = await supabase
                .from('ai_sales_campaign_contacts')
                .select('*, contacts(*)')
                .eq('campaign_id', campaign_id)
                .in('status', ['pending', 'active']);

              campaignContacts = newContacts || [];
              console.log(`Populated ${campaignContacts.length} contacts for campaign`);
            }
          }
        }
      }
    }

    let activatedCount = 0;

    // For each contact, create agent conversation
    for (const cc of campaignContacts || []) {
      try {
        console.log(`Creating agent conversation for contact: ${cc.contact_id}`);
        
        // Check if there's an existing active agent
        const { data: existingState } = await supabase
          .from('conversation_state')
          .select('active_agent_id, agent_queue')
          .eq('contact_id', cc.contact_id)
          .single();

        let previousAgentType: string | null = null;
        let shouldHandoff = false;
        
        // If there's an active agent, check if it's a product agent (not customer_service)
        if (existingState?.active_agent_id) {
          // Try to find in product_agents first
          const { data: productAgent } = await supabase
            .from('product_agents')
            .select('product_type')
            .eq('id', existingState.active_agent_id)
            .eq('status', 'active')
            .single();
          
          if (productAgent && productAgent.product_type !== 'customer_service') {
            previousAgentType = productAgent.product_type;
            shouldHandoff = true;
            console.log(`🔄 Handoff needed from product agent: ${previousAgentType}`);
          } else if (productAgent && productAgent.product_type === 'customer_service') {
            console.log(`✅ Only customer_service active - proceeding with sales introduction`);
          } else {
            // Check agent_conversations
            const { data: convAgent } = await supabase
              .from('agent_conversations')
              .select('agent_type')
              .eq('id', existingState.active_agent_id)
              .single();
            
            if (convAgent && convAgent.agent_type !== 'customer_service') {
              previousAgentType = convAgent.agent_type;
              shouldHandoff = true;
              console.log(`🔄 Handoff needed from agent conversation: ${previousAgentType}`);
            }
          }
        }
        
        // Check if agent conversation already exists
        const { data: existingConv } = await supabase
          .from('agent_conversations')
          .select('*')
          .eq('contact_id', cc.contact_id)
          .eq('agent_type', 'sales_agent')
          .single();

        let conversation;
        
        if (existingConv) {
          // Reuse existing conversation and update it
          console.log(`Reusing existing agent conversation: ${existingConv.id}`);
          
          const { data: updatedConv, error: updateError } = await supabase
            .from('agent_conversations')
            .update({
              status: 'active',
              expiration_date: getAgentExpirationDate('sales_agent'),
              updated_at: new Date().toISOString(),
            })
            .eq('id', existingConv.id)
            .select()
            .single();

          if (updateError) {
            console.error('Error updating existing conversation:', updateError);
            continue;
          }
          
          conversation = updatedConv;
        } else {
          // Create new agent conversation
          const { data: newConv, error: convError } = await supabase
            .from('agent_conversations')
            .insert({
              contact_id: cc.contact_id,
              agent_type: 'sales_agent',
              status: 'active',
              started_at: new Date().toISOString(),
              expiration_date: getAgentExpirationDate('sales_agent'),
            })
            .select()
            .single();

          if (convError) {
            console.error('Error creating conversation:', convError);
            continue;
          }
          
          conversation = newConv;
        }

        console.log(`Agent conversation created: ${conversation.id}`);

        // Update campaign contact with agent info
        const { error: updateError } = await supabase
          .from('ai_sales_campaign_contacts')
          .update({
            agent_id: conversation.id,
            agent_assigned_at: new Date().toISOString(),
            status: 'active',
          })
          .eq('id', cc.id);

        if (updateError) {
          console.error('Error updating campaign contact:', updateError);
        }

        // Store campaign strategy reference in conversation metadata
        const { error: metadataError } = await supabase
          .from('agent_conversations')
          .update({
            key_entities: {
              campaign_id: campaign_id,
              campaign_strategy: campaign.campaign_strategy || {},
            }
          })
          .eq('id', conversation.id);

        if (metadataError) {
          console.error('Error updating conversation metadata:', metadataError);
        }

        // Update or create conversation_state with priority and queue management
        const agentQueue = existingState?.agent_queue || [];
        
        // If there was a previous agent, add it to the queue
        if (existingState?.active_agent_id && previousAgentType) {
          agentQueue.push({
            agent_id: existingState.active_agent_id,
            agent_type: previousAgentType,
            queued_at: new Date().toISOString()
          });
        }

        // Use the unified recalculation function instead of manual priority setting
        // First upsert the conversation state with queue
        const { error: stateError } = await supabase
          .from('conversation_state')
          .upsert({
            contact_id: cc.contact_id,
            agent_queue: agentQueue,
            last_engagement_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'contact_id'
          });

        if (stateError) {
          console.error('Error updating conversation state:', stateError);
          continue;
        }

        // Now recalculate active agent using the unified function
        const { error: recalcError } = await supabase.rpc('recalculate_active_agent_unified', {
          p_contact_id: cc.contact_id
        });

        if (recalcError) {
          console.error('Error recalculating active agent:', recalcError);
        } else {
          console.log(`Active agent recalculated for contact: ${cc.contact_id}`);
        }

        // Generate handoff or introduction message
        console.log(`Generating ${previousAgentType ? 'handoff' : 'introduction'} message for contact: ${cc.contact_id}`);
        
        const messageResult = await supabase.functions.invoke('generate-ai-message', {
          body: {
            contact_id: cc.contact_id,
            agent_id: conversation.id,
            conversation_id: conversation.id,
            message_type: shouldHandoff ? 'handoff' : 'introduction',
            trigger_context: {
              campaign_id: campaign_id,
              campaign_strategy: campaign.campaign_strategy || {},
              previous_agent_type: previousAgentType,
              is_sales_campaign: true
            },
            channel: campaign.channel || 'sms'
          }
        });

        if (messageResult.error) {
          console.error('❌ Error generating message for contact:', cc.contact_id);
          console.error('Error details:', JSON.stringify(messageResult.error, null, 2));
          
          // Mark contact as failed with detailed retry information
          await supabase
            .from('ai_sales_campaign_contacts')
            .update({
              status: 'failed',
              last_error: JSON.stringify({
                error: messageResult.error.message || 'Message generation failed',
                full_error: messageResult.error,
                timestamp: new Date().toISOString(),
                retry_count: 0,
                message_type: previousAgentType ? 'handoff' : 'introduction',
                contact_name: cc.contacts?.full_name || 'Unknown'
              })
            })
            .eq('id', cc.id);
          
          console.log(`Contact ${cc.contact_id} marked as failed for manual retry`);
          continue; // Skip to next contact
        }
        
        console.log(`Message generated for contact: ${cc.contact_id}`);

        activatedCount++;
      } catch (error) {
        console.error('Error activating contact:', cc.contact_id, error);
      }
    }

    console.log(`Activated ${activatedCount} out of ${campaignContacts?.length || 0} contacts`);

    // Messages are sent immediately by generate-ai-message function
    // No need to process scheduled messages separately

    // Update campaign status
    await supabase
      .from('ai_sales_campaigns')
      .update({
        status: 'active',
        start_date: new Date().toISOString(),
        contacts_engaged: activatedCount,
      })
      .eq('id', campaign_id);

    return new Response(
      JSON.stringify({ 
        success: true,
        activated_count: activatedCount,
        total_contacts: campaignContacts?.length || 0,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Activate campaign error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});