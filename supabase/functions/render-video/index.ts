import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { composition, settings } = await req.json();
    
    console.log('Render request received:', {
      overlays: composition?.overlays?.length,
      settings
    });

    // Get user ID from auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    // Create job entry in database
    const { data: job, error: jobError } = await supabaseClient
      .from('video_render_jobs')
      .insert({
        user_id: user.id,
        composition_data: composition,
        settings: settings,
        status: 'queued',
        progress: 0,
      })
      .select()
      .single();

    if (jobError || !job) {
      throw new Error(`Failed to create job: ${jobError?.message}`);
    }

    console.log('Job created:', job.id);

    // Invoke process-render function asynchronously
    supabaseClient.functions.invoke('process-render', {
      body: { jobId: job.id },
    }).catch(err => console.error('Failed to invoke process-render:', err));

    return new Response(
      JSON.stringify({ 
        jobId: job.id,
        message: 'Render job created successfully'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('Error in render-video function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
