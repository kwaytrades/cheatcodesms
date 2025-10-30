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
      campaign_config,
      start_immediately = false 
    } = await req.json();

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
    const { data: matchingContacts } = await supabase.functions.invoke('filter-contacts', {
      body: { filters: audience_filter, limit: 10000 }
    });

    if (!matchingContacts || !matchingContacts.contacts) {
      throw new Error('Failed to fetch matching contacts');
    }

    const contactCount = matchingContacts.contacts.length;

    // Create campaign
    const { data: campaign, error: campaignError } = await supabase
      .from('ai_sales_campaigns')
      .insert({
        name,
        description,
        agent_type,
        audience_filter,
        campaign_config,
        contact_count: contactCount,
        status: start_immediately ? 'active' : 'draft',
        created_by: user.id,
        start_date: start_immediately ? new Date().toISOString() : null,
      })
      .select()
      .single();

    if (campaignError) {
      throw campaignError;
    }

    // Create campaign_contacts records
    const campaignContacts = matchingContacts.contacts.map((contact: any) => ({
      campaign_id: campaign.id,
      contact_id: contact.id,
      status: start_immediately ? 'active' : 'pending',
    }));

    if (campaignContacts.length > 0) {
      const { error: contactsError } = await supabase
        .from('ai_sales_campaign_contacts')
        .insert(campaignContacts);

      if (contactsError) {
        console.error('Error inserting campaign contacts:', contactsError);
      }
    }

    // If starting immediately, trigger activation
    if (start_immediately) {
      await supabase.functions.invoke('activate-sales-campaign', {
        body: { campaign_id: campaign.id }
      });
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