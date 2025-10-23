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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const { compositionData, title } = await req.json();
    console.log('Received render request for user:', user.id);
    console.log('Composition data:', JSON.stringify(compositionData, null, 2));

    // Transform editor composition to Remotion format
    const remotionData = {
      overlays: compositionData.overlays.map((overlay: any) => ({
        ...overlay,
        // Ensure paths are absolute URLs for Remotion
        src: overlay.src?.startsWith('http') ? overlay.src : 
             overlay.src?.startsWith('blob:') ? overlay.src :
             overlay.src ? `${supabaseUrl}/storage/v1/object/public/${overlay.src}` : undefined,
      })),
      durationInFrames: compositionData.durationInFrames,
      fps: compositionData.fps || 30,
      width: compositionData.width,
      height: compositionData.height,
    };

    const settings = {
      width: compositionData.width,
      height: compositionData.height,
      fps: compositionData.fps || 30,
      codec: 'h264',
      quality: 8,
    };

    console.log('Calling render-video-remotion with data:', { remotionData, settings });

    // Call existing Remotion render function
    const { data: renderData, error: renderError } = await supabase.functions.invoke(
      'render-video-remotion',
      {
        body: {
          compositionData: remotionData,
          settings,
          jobId: crypto.randomUUID(),
        }
      }
    );

    if (renderError) {
      console.error('Render error:', renderError);
      throw new Error(`Render failed: ${renderError.message}`);
    }

    console.log('Render response:', renderData);

    // The render-video-remotion function handles the full render and upload
    // It returns the job details which we can track
    const jobId = renderData.jobId;
    
    // Poll for completion (max 5 minutes)
    let attempts = 0;
    const maxAttempts = 60; // 5 minutes with 5 second intervals
    let videoUrl = null;
    let renderStatus = 'rendering';

    while (attempts < maxAttempts && !videoUrl) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      attempts++;

      // Check job status
      const { data: jobData } = await supabase
        .from('video_render_jobs')
        .select('*')
        .eq('id', jobId)
        .single();

      if (jobData) {
        renderStatus = jobData.status;
        console.log(`Render job status (attempt ${attempts}/${maxAttempts}):`, renderStatus, jobData.progress);
        
        if (jobData.status === 'completed' && jobData.video_url) {
          videoUrl = jobData.video_url;
          break;
        } else if (jobData.status === 'failed') {
          throw new Error(`Render failed: ${jobData.error_message}`);
        }
      }
    }

    if (!videoUrl) {
      throw new Error('Render timeout - video took too long to process');
    }

    console.log('Video rendered successfully:', videoUrl);

    // Get video duration
    const durationSeconds = Math.round(compositionData.durationInFrames / (compositionData.fps || 30));

    // Create entry in content_videos
    const { data: videoEntry, error: videoError } = await supabase
      .from('content_videos')
      .insert({
        user_id: user.id,
        video_url: videoUrl,
        duration_seconds: durationSeconds,
        title: title || `Editor Video ${new Date().toLocaleDateString()}`,
        source: 'editor',
        composition_data: compositionData,
        is_final: true,
      })
      .select()
      .single();

    if (videoError) {
      console.error('Error creating video entry:', videoError);
      throw videoError;
    }

    console.log('Video entry created:', videoEntry.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        videoId: videoEntry.id,
        videoUrl: videoUrl,
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error in render-editor-composition:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
