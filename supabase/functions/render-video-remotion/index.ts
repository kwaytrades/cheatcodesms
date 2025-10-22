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
    const remotionApiKey = Deno.env.get('REMOTION_API_KEY');

    if (!remotionApiKey) {
      console.error('REMOTION_API_KEY not configured');
      throw new Error('REMOTION_API_KEY not configured');
    }

    if (!jobId) {
      throw new Error('jobId is required');
    }

    console.log('Starting Remotion Cloud render for job:', jobId);

    // Update job status to rendering
    const { error: updateError } = await supabaseClient
      .from('video_render_jobs')
      .update({ status: 'rendering', progress: 10 })
      .eq('id', jobId);

    if (updateError) {
      console.error('Failed to update job status:', updateError);
      throw new Error(`Failed to update job status: ${updateError.message}`);
    }

    // Prepare composition for Remotion Cloud
    const compositionId = 'Main';
    
    // Call Remotion Cloud API to start rendering
    const renderResponse = await fetch('https://api.remotion.dev/v1/renders', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${remotionApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        composition: compositionId,
        // Use Remotion's hosted bundle approach - no separate hosting needed
        serveUrl: compositionData.serveUrl || 'https://remotion-hosted-bundle.example.com',
        inputProps: {
          overlays: compositionData.overlays,
          durationInFrames: compositionData.durationInFrames,
          fps: compositionData.fps,
          width: settings.width,
          height: settings.height,
        },
        codec: 'h264',
        imageFormat: 'jpeg',
        quality: settings.quality || 90,
        privacy: 'private',
      }),
    });

    if (!renderResponse.ok) {
      const errorText = await renderResponse.text();
      console.error('Remotion API error:', errorText);
      throw new Error(`Remotion API error: ${renderResponse.status} - ${errorText}`);
    }

    const renderData = await renderResponse.json();
    const renderId = renderData.renderId;

    console.log('Remotion render started:', renderId);

    // Update job with render ID
    await supabaseClient
      .from('video_render_jobs')
      .update({ 
        progress: 20,
        composition_data: { ...compositionData, remotionRenderId: renderId }
      })
      .eq('id', jobId);

    // Poll for render completion
    let attempts = 0;
    const maxAttempts = 300; // 5 minutes with 1-second intervals
    let renderComplete = false;
    let videoUrl = null;

    while (attempts < maxAttempts && !renderComplete) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const statusResponse = await fetch(`https://api.remotion.dev/v1/renders/${renderId}`, {
        headers: {
          'Authorization': `Bearer ${remotionApiKey}`,
        },
      });

      if (!statusResponse.ok) {
        throw new Error(`Failed to check render status: ${statusResponse.status}`);
      }

      const statusData = await statusResponse.json();
      const progress = Math.min(20 + Math.floor((statusData.progress || 0) * 70), 90);

      await supabaseClient
        .from('video_render_jobs')
        .update({ progress })
        .eq('id', jobId);

      if (statusData.status === 'done') {
        renderComplete = true;
        videoUrl = statusData.url;
        console.log('Render completed:', videoUrl);
      } else if (statusData.status === 'error') {
        throw new Error(`Render failed: ${statusData.error}`);
      }

      attempts++;
    }

    if (!renderComplete) {
      throw new Error('Render timeout - took longer than expected');
    }

    // Download the video from Remotion and upload to Supabase Storage
    const videoResponse = await fetch(videoUrl);
    const videoBlob = await videoResponse.blob();
    const arrayBuffer = await videoBlob.arrayBuffer();
    
    const fileName = `${jobId}-export.mp4`;
    const { data: uploadData, error: uploadError } = await supabaseClient
      .storage
      .from('content-videos')
      .upload(fileName, arrayBuffer, {
        contentType: 'video/mp4',
        upsert: true,
      });

    if (uploadError) {
      throw new Error(`Upload failed: ${uploadError.message}`);
    }

    // Get public URL
    const { data: { publicUrl } } = supabaseClient
      .storage
      .from('content-videos')
      .getPublicUrl(fileName);

    // Mark job as completed
    await supabaseClient
      .from('video_render_jobs')
      .update({ 
        status: 'completed', 
        progress: 100,
        video_url: publicUrl
      })
      .eq('id', jobId);

    console.log('Video uploaded successfully:', publicUrl);

    return new Response(
      JSON.stringify({ success: true, jobId, videoUrl: publicUrl }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error in render-video-remotion:', error);
    
    // Try to extract jobId from request for error handling
    try {
      const body = await req.json();
      if (body?.jobId) {
        const supabaseClient = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );
        
        await supabaseClient
          .from('video_render_jobs')
          .update({ 
            status: 'failed',
            error_message: error.message || 'Unknown error occurred',
            progress: 0
          })
          .eq('id', body.jobId);
      }
    } catch (parseError) {
      console.error('Failed to parse request body for error handling:', parseError);
    }

    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
