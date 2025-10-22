import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { compositionData, settings, jobId } = await req.json();

    console.log('Render job started:', jobId);

    // Update job status to rendering
    await supabaseClient
      .from('video_render_jobs')
      .update({ status: 'rendering', progress: 15 })
      .eq('id', jobId);

    // Simulate rendering process with progress updates
    for (let i = 20; i <= 90; i += 10) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      await supabaseClient
        .from('video_render_jobs')
        .update({ progress: i })
        .eq('id', jobId);
    }

    // Mark as completed (in production, this would be after actual rendering)
    const videoUrl = `https://example.com/video-${jobId}.mp4`;
    
    await supabaseClient
      .from('video_render_jobs')
      .update({ 
        status: 'completed', 
        progress: 100,
        video_url: videoUrl 
      })
      .eq('id', jobId);

    console.log('Render job completed:', jobId);

    return new Response(
      JSON.stringify({ success: true, jobId }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error in render-video-mp4:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
