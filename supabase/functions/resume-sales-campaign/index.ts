import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { campaign_id } = await req.json()

    if (!campaign_id) {
      throw new Error('campaign_id is required')
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    console.log('Resuming sales campaign:', campaign_id)

    // Get campaign first
    const { data: campaign, error: fetchError } = await supabase
      .from('ai_sales_campaigns')
      .select('*')
      .eq('id', campaign_id)
      .single()

    if (fetchError || !campaign) {
      console.error('Error fetching campaign:', fetchError)
      throw new Error('Campaign not found')
    }

    // Safety check: If no contacts exist, populate them from audience_filter
    const { data: existingContacts } = await supabase
      .from('ai_sales_campaign_contacts')
      .select('id')
      .eq('campaign_id', campaign_id)
      .limit(1)

    if (!existingContacts || existingContacts.length === 0) {
      console.log('No contacts found, populating from audience_filter...')
      
      if (campaign.audience_filter && Array.isArray(campaign.audience_filter)) {
        const filters = campaign.audience_filter.map((filter: any) => {
          const { id, ...rest } = filter;
          return rest;
        });

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
              console.error('Error inserting campaign contacts:', insertError)
            } else {
              await supabase
                .from('ai_sales_campaigns')
                .update({ contact_count: filterData.total })
                .eq('id', campaign_id)
            }
          }
        }
      }
    }

    // Update campaign status to active
    const { data: updatedCampaign, error: campaignError } = await supabase
      .from('ai_sales_campaigns')
      .update({ 
        status: 'active',
        updated_at: new Date().toISOString()
      })
      .eq('id', campaign_id)
      .select()
      .single()

    if (campaignError) {
      console.error('Error resuming campaign:', campaignError)
      throw campaignError
    }

    // Update all paused campaign contacts back to active status
    const { data: contacts, error: contactsError } = await supabase
      .from('ai_sales_campaign_contacts')
      .update({ 
        status: 'active',
        updated_at: new Date().toISOString()
      })
      .eq('campaign_id', campaign_id)
      .eq('status', 'paused')
      .select()

    if (contactsError) {
      console.error('Error resuming campaign contacts:', contactsError)
      throw contactsError
    }

    console.log(`Campaign ${campaign_id} resumed. ${contacts?.length || 0} contacts updated.`)

    return new Response(
      JSON.stringify({ 
        success: true, 
        campaign: updatedCampaign,
        contacts_updated: contacts?.length || 0
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )
  } catch (error) {
    console.error('Error in resume-sales-campaign:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    )
  }
})
