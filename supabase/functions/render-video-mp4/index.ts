import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { bundle } from "https://deno.land/x/emit@0.31.0/mod.ts";
import { renderMedia } from "npm:@remotion/renderer@4.0.364";

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
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { compositionData, settings, jobId } = await req.json();

    console.log('Starting MP4 render job:', jobId);
    console.log('Composition data:', compositionData);
    console.log('Settings:', settings);

    // Update job status to rendering
    await supabase
      .from('video_render_jobs')
      .update({ 
        status: 'rendering',
        progress: 5 
      })
      .eq('id', jobId);

    // Create a temporary directory for rendering
    const tempDir = await Deno.makeTempDir();
    const outputPath = `${tempDir}/output.mp4`;

    console.log('Temp directory:', tempDir);
    console.log('Output path:', outputPath);

    // Bundle the Remotion entry point
    const entryPoint = `
      import React from "react";
      import { Composition } from "remotion";
      import { AbsoluteFill, Audio, Img, Video, Sequence } from "remotion";

      const compositionData = ${JSON.stringify(compositionData)};

      const Layer = ({ overlay, selectedOverlayId }) => {
        const style = {
          position: "absolute",
          left: overlay.left,
          top: overlay.top,
          width: overlay.width,
          height: overlay.height,
          transform: \`rotate(\${overlay.rotation || 0}deg)\`,
          transformOrigin: "center center",
          zIndex: (overlay.row || 0) * 10,
        };

        if (overlay.type === "sound") {
          return (
            <Audio
              src={overlay.src}
              startFrom={Math.floor(overlay.startTime * ${compositionData.fps})}
              endAt={Math.floor(overlay.endTime * ${compositionData.fps})}
              volume={overlay.volume || 1}
            />
          );
        }

        if (overlay.type === "video") {
          return (
            <div style={style}>
              <Video
                src={overlay.src}
                startFrom={Math.floor(overlay.startTime * ${compositionData.fps})}
                endAt={Math.floor(overlay.endTime * ${compositionData.fps})}
                volume={overlay.volume || 1}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: overlay.objectFit || "contain",
                  filter: overlay.filter || "none",
                  borderRadius: overlay.borderRadius || 0,
                }}
              />
            </div>
          );
        }

        if (overlay.type === "image") {
          return (
            <div style={style}>
              <Img
                src={overlay.src}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: overlay.objectFit || "contain",
                  filter: overlay.filter || "none",
                  borderRadius: overlay.borderRadius || 0,
                }}
              />
            </div>
          );
        }

        if (overlay.type === "text") {
          return (
            <div
              style={{
                ...style,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: overlay.backgroundColor || "transparent",
              }}
            >
              <div
                style={{
                  fontFamily: overlay.fontFamily || "Arial",
                  fontSize: overlay.fontSize || 24,
                  fontWeight: overlay.fontWeight || "normal",
                  fontStyle: overlay.fontStyle || "normal",
                  color: overlay.color || "#ffffff",
                  textAlign: overlay.textAlign || "left",
                  textDecoration: overlay.textDecoration || "none",
                }}
              >
                {overlay.content}
              </div>
            </div>
          );
        }

        return null;
      };

      const Main = ({ overlays }) => {
        return (
          <AbsoluteFill style={{ backgroundColor: "#111827" }}>
            <AbsoluteFill style={{ overflow: "hidden", maxWidth: "3000px" }}>
              {overlays.map((overlay) => (
                <Sequence
                  key={overlay.id}
                  from={overlay.from}
                  durationInFrames={overlay.durationInFrames}
                  layout={overlay.type === "sound" ? undefined : "none"}
                >
                  <Layer overlay={overlay} selectedOverlayId={null} />
                </Sequence>
              ))}
            </AbsoluteFill>
          </AbsoluteFill>
        );
      };

      export const RemotionRoot = () => {
        return (
          <Composition
            id="Main"
            component={Main}
            durationInFrames={${compositionData.durationInFrames}}
            fps={${compositionData.fps}}
            width={${compositionData.width}}
            height={${compositionData.height}}
            defaultProps={{ overlays: compositionData.overlays }}
          />
        );
      };
    `;

    // Write entry point to temp file
    const entryPath = `${tempDir}/index.tsx`;
    await Deno.writeTextFile(entryPath, entryPoint);

    console.log('Entry point written to:', entryPath);

    // Update progress
    await supabase
      .from('video_render_jobs')
      .update({ progress: 10 })
      .eq('id', jobId);

    // Render the video
    console.log('Starting Remotion render...');
    
    await renderMedia({
      composition: "Main",
      serveUrl: tempDir,
      codec: "h264",
      outputLocation: outputPath,
      inputProps: {},
      onProgress: async ({ progress }) => {
        const renderProgress = Math.floor(10 + (progress * 80));
        console.log('Render progress:', renderProgress);
        await supabase
          .from('video_render_jobs')
          .update({ progress: renderProgress })
          .eq('id', jobId);
      },
    });

    console.log('Render complete, uploading to storage...');

    // Update progress
    await supabase
      .from('video_render_jobs')
      .update({ progress: 95 })
      .eq('id', jobId);

    // Read the rendered file
    const videoData = await Deno.readFile(outputPath);

    // Upload to Supabase Storage
    const fileName = `${jobId}.mp4`;
    const { data: uploadData, error: uploadError } = await supabase
      .storage
      .from('content-videos')
      .upload(fileName, videoData, {
        contentType: 'video/mp4',
        upsert: true,
      });

    if (uploadError) {
      throw new Error(`Upload failed: ${uploadError.message}`);
    }

    console.log('Upload complete:', uploadData);

    // Get public URL
    const { data: urlData } = supabase
      .storage
      .from('content-videos')
      .getPublicUrl(fileName);

    // Update job with completion
    await supabase
      .from('video_render_jobs')
      .update({ 
        status: 'completed',
        progress: 100,
        video_url: urlData.publicUrl,
      })
      .eq('id', jobId);

    // Clean up temp files
    await Deno.remove(tempDir, { recursive: true });

    console.log('Job complete!');

    return new Response(
      JSON.stringify({
        success: true,
        videoUrl: urlData.publicUrl,
        jobId,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error rendering video:', error);

    // Try to update job status to failed if we have the jobId
    try {
      const { jobId } = await req.json();
      if (jobId) {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        await supabase
          .from('video_render_jobs')
          .update({ 
            status: 'failed',
            error_message: error.message,
          })
          .eq('id', jobId);
      }
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
