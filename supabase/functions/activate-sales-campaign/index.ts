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

    // Get all pending contacts in campaign
    const { data: campaignContacts, error: contactsError } = await supabase
      .from('ai_sales_campaign_contacts')
      .select('*, contacts(*)')
      .eq('campaign_id', campaign_id)
      .in('status', ['pending', 'active']);

    if (contactsError) {
      throw contactsError;
    }

    let activatedCount = 0;

    // For each contact, create agent conversation
    for (const cc of campaignContacts || []) {
      try {
        console.log(`Creating agent conversation for contact: ${cc.contact_id}`);
        
        // Create agent conversation
        const { data: conversation, error: convError } = await supabase
          .from('agent_conversations')
          .insert({
            contact_id: cc.contact_id,
            agent_type: campaign.agent_type,
            status: 'active',
            started_at: new Date().toISOString(),
            expiration_date: getAgentExpirationDate(campaign.agent_type),
          })
          .select()
          .single();

        if (convError) {
          console.error('Error creating conversation:', convError);
          continue;
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

        // Update or create conversation_state
        const { error: stateError } = await supabase
          .from('conversation_state')
          .upsert({
            contact_id: cc.contact_id,
            active_agent_id: conversation.id,
            agent_priority: campaign.agent_type === 'sales_agent' ? 10 : 3,
            last_engagement_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'contact_id'
          });

        if (stateError) {
          console.error('Error updating conversation state:', stateError);
        } else {
          console.log(`Conversation state updated for contact: ${cc.contact_id}`);
        }

        activatedCount++;
      } catch (error) {
        console.error('Error activating contact:', cc.contact_id, error);
      }
    }

    console.log(`Activated ${activatedCount} out of ${campaignContacts?.length || 0} contacts`);

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