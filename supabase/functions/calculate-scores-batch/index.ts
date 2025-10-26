import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ContactData {
  id: string;
  email?: string;
  total_spent?: number;
  engagement_score?: number;
  disputed_amount?: number;
  has_disputed?: boolean;
  products_owned?: string[];
  tags?: string[];
  lead_status?: string;
  webinar_attendance?: any[];
  form_submissions?: any[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { contactIds } = await req.json();
    
    if (!contactIds || !Array.isArray(contactIds) || contactIds.length === 0) {
      throw new Error("contactIds array is required");
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`Calculating scores for ${contactIds.length} contacts...`);

    // Process in chunks of 10 to avoid overwhelming the system
    const chunkSize = 10;
    let processed = 0;
    let updated = 0;
    const errors: string[] = [];

    for (let i = 0; i < contactIds.length; i += chunkSize) {
      const chunk = contactIds.slice(i, i + chunkSize);
      
      // Fetch contacts in this chunk
      const { data: contacts, error: fetchError } = await supabase
        .from('contacts')
        .select('id, email, total_spent, engagement_score, disputed_amount, has_disputed, products_owned, tags, lead_status, webinar_attendance, form_submissions')
        .in('id', chunk);

      if (fetchError) {
        console.error(`Error fetching chunk:`, fetchError);
        errors.push(`Fetch error: ${fetchError.message}`);
        continue;
      }

      if (!contacts || contacts.length === 0) {
        console.log(`No contacts found in chunk ${i / chunkSize + 1}`);
        continue;
      }

      // Calculate scores for each contact
      for (const contact of contacts) {
        try {
          // Call unified scorer
          const { data: scoreResult, error: scoreError } = await supabase.functions.invoke('calculate-unified-score', {
            body: { contactId: contact.id }
          });

          if (scoreError) {
            console.error(`Failed to calculate score for ${contact.id}:`, scoreError);
            errors.push(`Score error for ${contact.email}: ${scoreError.message}`);
            processed++;
            continue;
          }

          const { lead_score, lead_status, likelihood_category } = scoreResult;
          
          const { error: updateError } = await supabase
            .from('contacts')
            .update({
              lead_score,
              likelihood_to_buy_score: lead_score,
              likelihood_category,
              lead_status,
              last_score_update: new Date().toISOString(),
            })
            .eq('id', contact.id);

          if (updateError) {
            console.error(`Error updating contact ${contact.id}:`, updateError);
            errors.push(`Update error for ${contact.email}: ${updateError.message}`);
          } else {
            updated++;
          }
          
          processed++;
        } catch (err: any) {
          console.error(`Error processing contact ${contact.id}:`, err);
          errors.push(`Processing error for ${contact.id}: ${err?.message || 'Unknown error'}`);
        }
      }

      // Small delay between chunks
      if (i + chunkSize < contactIds.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    console.log(`Score calculation complete: ${updated}/${processed} contacts updated`);

    return new Response(
      JSON.stringify({
        success: true,
        processed,
        updated,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : "Unknown error" 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
