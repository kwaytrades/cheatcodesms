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
    const { contact_id } = await req.json();

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`Recalculating agent priority for contact: ${contact_id}`);

    // Call the unified recalculation function
    const { error } = await supabase.rpc('recalculate_active_agent_unified', {
      p_contact_id: contact_id
    });

    if (error) {
      console.error('Error recalculating:', error);
      throw error;
    }

    // Get updated state
    const { data: updatedState } = await supabase
      .from('conversation_state')
      .select('active_agent_id, agent_priority')
      .eq('contact_id', contact_id)
      .single();

    console.log(`Recalculation complete. New active agent:`, updatedState);

    return new Response(
      JSON.stringify({ 
        success: true,
        active_agent_id: updatedState?.active_agent_id,
        priority: updatedState?.agent_priority
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Recalculate error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
