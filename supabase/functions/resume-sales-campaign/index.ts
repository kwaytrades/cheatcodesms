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

    // Update campaign status to active
    const { data: campaign, error: campaignError } = await supabase
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
        campaign,
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
