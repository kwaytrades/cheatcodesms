import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      name, 
      description, 
      agent_type, 
      audience_filter, 
      campaign_strategy,
      start_immediately = false,
      channel = 'sms'
    } = await req.json();

    console.log('═══════════════════════════════════════════════');
    console.log('CREATE-SALES-CAMPAIGN INVOKED');
    console.log('Campaign Name:', name);
    console.log('Agent Type:', agent_type);
    console.log('Channel:', channel);
    console.log('Start Immediately:', start_immediately);
    console.log('Audience Filters:', JSON.stringify(audience_filter, null, 2));
    console.log('═══════════════════════════════════════════════');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get auth user
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabase.auth.getUser(token);

    if (!user) {
      throw new Error('Unauthorized');
    }

    // Validate agent type
    if (!['sales_agent', 'lead_nurture'].includes(agent_type)) {
      throw new Error('Invalid agent type. Must be sales_agent or lead_nurture');
    }

    // Get matching contacts
    console.log('Fetching matching contacts...');
    const { data: matchingContacts, error: filterError } = await supabase.functions.invoke('filter-contacts', {
      body: { filters: audience_filter, limit: 10000 }
    });

    if (filterError) {
      console.error('filter-contacts error:', filterError);
      throw new Error(`Failed to fetch matching contacts: ${filterError.message}`);
    }

    if (!matchingContacts || !matchingContacts.contacts) {
      console.error('Invalid response from filter-contacts:', matchingContacts);
      throw new Error('Failed to fetch matching contacts - invalid response');
    }

    console.log('Contacts fetched:', matchingContacts.contacts.length);
    console.log('Contact structure sample:', matchingContacts.contacts[0]);

    const contactCount = matchingContacts.contacts.length;

    if (contactCount === 0) {
      throw new Error('No contacts match the selected filters');
    }

    // Create campaign
    console.log('Creating campaign record...');
    const { data: campaign, error: campaignError } = await supabase
      .from('ai_sales_campaigns')
      .insert({
        name,
        description,
        agent_type,
        audience_filter,
        campaign_strategy,
        contact_count: contactCount,
        status: start_immediately ? 'active' : 'draft',
        created_by: user.id,
        start_date: start_immediately ? new Date().toISOString() : null,
        channel,
      })
      .select()
      .single();

    if (campaignError) {
      console.error('Campaign creation error:', campaignError);
      throw campaignError;
    }

    console.log('Campaign created successfully:', campaign.id);

    // Create campaign_contacts records
    const campaignContacts = matchingContacts.contacts.map((contact: any) => ({
      campaign_id: campaign.id,
      contact_id: contact.id,
      status: start_immediately ? 'active' : 'pending',
    }));

    console.log(`Inserting ${campaignContacts.length} campaign contacts...`);
    
    if (campaignContacts.length > 0) {
      const { data: insertedContacts, error: contactsError } = await supabase
        .from('ai_sales_campaign_contacts')
        .insert(campaignContacts)
        .select();

      if (contactsError) {
        console.error('❌ CRITICAL: Error inserting campaign contacts:', contactsError);
        console.error('Contact insert payload sample:', campaignContacts[0]);
        
        // Don't throw - mark campaign but return error info
        await supabase
          .from('ai_sales_campaigns')
          .update({ 
            status: 'error',
            contact_count: 0 
          })
          .eq('id', campaign.id);
        
        throw new Error(`Campaign created but failed to add contacts: ${contactsError.message}`);
      }

      console.log('✅ Successfully inserted campaign contacts:', insertedContacts?.length || 0);
    }

    // If starting immediately, trigger activation
    if (start_immediately) {
      console.log('Activating campaign immediately:', campaign.id);
      const { data: activationResult, error: activationError } = await supabase.functions.invoke('activate-sales-campaign', {
        body: { campaign_id: campaign.id }
      });
      
      if (activationError) {
        console.error('Activation error:', activationError);
      } else {
        console.log('Activation result:', activationResult);
      }
    }

    return new Response(
      JSON.stringify({ 
        campaign, 
        contact_count: contactCount 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Create campaign error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});