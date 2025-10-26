import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// DEPRECATED: All scoring logic has been moved to calculate-unified-score function
// These functions are no longer used and maintained for reference only

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const { contactId, messageBody, force = false } = await req.json();
    
    if (!contactId) {
      return new Response(JSON.stringify({ error: 'contactId required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`📊 Calculating real-time scores for contact: ${contactId}`);

    // Fetch contact data
    const { data: contact, error: contactError } = await supabase
      .from('contacts')
      .select('*')
      .eq('id', contactId)
      .single();

    if (contactError || !contact) {
      throw new Error('Contact not found');
    }

    // Check if score was updated recently (avoid rate limiting)
    if (!force && contact.last_score_update) {
      const lastUpdate = new Date(contact.last_score_update);
      const hoursSinceUpdate = (Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60);
      
      // Skip if updated within last hour
      if (hoursSinceUpdate < 1) {
        console.log('⏭️ Score was updated recently, skipping...');
        return new Response(
          JSON.stringify({ 
            message: 'Score updated recently', 
            skipped: true,
            last_update: contact.last_score_update 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Call unified scorer
    const { data: scoreResult, error: scoreError } = await supabase.functions.invoke('calculate-unified-score', {
      body: { contactId, forceRecalculate: force }
    });

    if (scoreError) {
      throw scoreError;
    }

    const { lead_score, lead_status, likelihood_category, breakdown } = scoreResult;

    // Update the contact with new scores
    const { error: updateError } = await supabase
      .from('contacts')
      .update({
        lead_score,
        engagement_score: breakdown.messageIntelligence || 0,
        lead_status,
        likelihood_category,
        likelihood_to_buy_score: lead_score,
        last_score_update: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', contactId);

    if (updateError) {
      throw updateError;
    }

    console.log('✅ Scores updated:', {
      contactId,
      lead_score,
      lead_status,
      breakdown
    });

    return new Response(
      JSON.stringify({
        success: true,
        contactId,
        scores: {
          lead_score,
          engagement_score: breakdown.messageIntelligence || 0,
          lead_status,
          likelihood_category
        },
        breakdown
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error updating contact scores:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
