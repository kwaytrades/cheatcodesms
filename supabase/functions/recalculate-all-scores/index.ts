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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const { limit = 5000, force = false } = await req.json().catch(() => ({}));
    
    console.log(`🔄 Starting batch score recalculation (limit: ${limit}, force: ${force})`);

    let query = supabase
      .from('contacts')
      .select('id, full_name, last_engagement_date, last_score_update');

    if (!force) {
      // Smart filtering: only active contacts, skip recently updated
      const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      
      query = query
        .gte('last_engagement_date', sevenDaysAgo)
        .or(`last_score_update.is.null,last_score_update.lt.${thirtyMinutesAgo}`);
    } else {
      console.log('🔥 FORCE MODE: Processing all contacts');
    }

    query = query.limit(limit);
    const { data: activeContacts, error: fetchError } = await query;

    if (fetchError) {
      throw fetchError;
    }

    if (!activeContacts || activeContacts.length === 0) {
      console.log('✅ No contacts need score updates');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No contacts need updates',
          processed: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📋 Found ${activeContacts.length} contacts to update`);

    // Process in batches of 100 to avoid timeout
    const batchSize = 100;
    let processed = 0;
    let succeeded = 0;
    let failed = 0;
    const errors: any[] = [];

    for (let i = 0; i < activeContacts.length; i += batchSize) {
      const batch = activeContacts.slice(i, i + batchSize);
      console.log(`🔄 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(activeContacts.length / batchSize)}`);

      // Process batch in parallel
      const results = await Promise.allSettled(
        batch.map(contact => 
          supabase.functions.invoke('update-contact-scores-realtime', {
            body: { 
              contactId: contact.id,
              messageBody: null // No specific message, analyze full history
            }
          })
        )
      );

      results.forEach((result, idx) => {
        processed++;
        if (result.status === 'fulfilled' && !result.value.error) {
          succeeded++;
        } else {
          failed++;
          const contact = batch[idx];
          errors.push({
            contactId: contact.id,
            contactName: contact.full_name,
            error: result.status === 'rejected' ? result.reason : result.value.error
          });
        }
      });

      // Small delay between batches to avoid rate limits
      if (i + batchSize < activeContacts.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    console.log(`✅ Batch recalculation complete: ${succeeded} succeeded, ${failed} failed`);
    
    if (errors.length > 0) {
      console.error('❌ Errors:', errors.slice(0, 10)); // Log first 10 errors
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed,
        succeeded,
        failed,
        errors: errors.slice(0, 10), // Return first 10 errors
        totalContacts: activeContacts.length
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in batch score recalculation:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
