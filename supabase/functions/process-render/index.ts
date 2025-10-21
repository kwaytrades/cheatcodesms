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
    const { jobId } = await req.json();
    
    console.log('Processing render job:', jobId);

    // Create Supabase client with service role for full access
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Fetch job details
    const { data: job, error: jobError } = await supabaseAdmin
      .from('video_render_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (jobError || !job) {
      throw new Error(`Job not found: ${jobError?.message}`);
    }

    // Update status to rendering
    await supabaseAdmin
      .from('video_render_jobs')
      .update({ status: 'rendering', progress: 0 })
      .eq('id', jobId);

    const composition = job.composition_data;
    const settings = job.settings;

    console.log('Composition:', {
      overlays: composition.overlays?.length,
      width: composition.width,
      height: composition.height,
      fps: composition.fps,
      durationInFrames: composition.durationInFrames,
    });

    // NOTE: This is where the actual Remotion rendering would happen
    // The full implementation requires:
    // 1. Bundle the Remotion composition
    // 2. Download video assets from storage with signed URLs
    // 3. Use @remotion/renderer's renderMedia() function
    // 4. Upload the output to storage
    // 5. Update job with video URL
    
    // For now, simulate rendering with progress updates
    for (let progress = 0; progress <= 100; progress += 20) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      await supabaseAdmin
        .from('video_render_jobs')
        .update({ progress })
        .eq('id', jobId);
      console.log(`Job ${jobId} progress: ${progress}%`);
    }

    // Simulate completion
    const mockVideoUrl = `https://placehold.co/1920x1080/mp4`;
    
    await supabaseAdmin
      .from('video_render_jobs')
      .update({ 
        status: 'done',
        progress: 100,
        video_url: mockVideoUrl,
        error_message: 'Demo mode: Full Remotion server-side rendering requires additional setup with @remotion/renderer, FFmpeg, and proper bundling configuration.'
      })
      .eq('id', jobId);

    console.log('Job completed:', jobId);

    return new Response(
      JSON.stringify({ success: true, jobId }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('Error in process-render function:', error);
    
    // Try to update job status to error
    try {
      const { jobId } = await req.json();
      const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      );
      
      await supabaseAdmin
        .from('video_render_jobs')
        .update({ 
          status: 'error',
          error_message: error.message 
        })
        .eq('id', jobId);
    } catch (updateError) {
      console.error('Failed to update job status:', updateError);
    }

    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
