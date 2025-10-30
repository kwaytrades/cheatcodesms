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

    console.log('Stopping sales campaign:', campaign_id)

    // Update campaign status to completed
    const { data: campaign, error: campaignError } = await supabase
      .from('ai_sales_campaigns')
      .update({ 
        status: 'completed',
        end_date: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', campaign_id)
      .select()
      .single()

    if (campaignError) {
      console.error('Error stopping campaign:', campaignError)
      throw campaignError
    }

    // Update all campaign contacts to completed status
    const { data: contacts, error: contactsError } = await supabase
      .from('ai_sales_campaign_contacts')
      .update({ 
        status: 'completed',
        updated_at: new Date().toISOString()
      })
      .eq('campaign_id', campaign_id)
      .in('status', ['active', 'paused', 'pending'])
      .select()

    if (contactsError) {
      console.error('Error stopping campaign contacts:', contactsError)
      throw contactsError
    }

    // Expire all related agent conversations
    const contactIds = contacts?.map(c => c.contact_id) || []
    
    if (contactIds.length > 0) {
      const { data: expiredAgents, error: agentError } = await supabase
        .from('agent_conversations')
        .update({
          status: 'expired',
          expiration_date: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .in('contact_id', contactIds)
        .eq('agent_type', 'sales_agent')
        .eq('status', 'active')
        .select()

      if (agentError) {
        console.error('Error expiring agent conversations:', agentError)
      } else {
        console.log(`Expired ${expiredAgents?.length || 0} agent conversations`)
      }
    }

    console.log(`Campaign ${campaign_id} stopped. ${contacts?.length || 0} contacts completed.`)

    return new Response(
      JSON.stringify({ 
        success: true, 
        campaign,
        contacts_updated: contacts?.length || 0
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )
  } catch (error) {
    console.error('Error in stop-sales-campaign:', error)
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
