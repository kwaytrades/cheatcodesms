import { useState, useEffect, useRef } from "react";
import { Overlay } from "@/lib/video-editor/types";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { VideoRenderJob } from "@/lib/video-editor/supabase-types";
import { prepareCompositionData, prepareExportSettings } from "@/lib/video-editor/remotion-adapter";

export const useVideoExport = (
  overlays: Overlay[],
  durationInFrames: number,
  fps: number,
  playerDimensions: { width: number; height: number }
) => {
  const [progress, setProgress] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const cancelExportRef = useRef(false);

  // Subscribe to job progress updates
  useEffect(() => {
    if (!jobId) return;

    const channel = supabase
      .channel(`render-job-${jobId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'video_render_jobs',
          filter: `id=eq.${jobId}`,
        },
        (payload) => {
          const job = payload.new as VideoRenderJob;
          console.log('Job update from Realtime:', job);
          
          // Only update progress, don't handle download here
          setProgress(job.progress || 0);
          
          if (job.status === 'failed') {
            setIsLoading(false);
            setJobId(null);
            toast.error(`Export failed: ${job.error_message || 'Unknown error'}`);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [jobId]);

  const cancelExport = async () => {
    cancelExportRef.current = true;
    
    if (jobId) {
      // Cancel the job on the server
      await supabase
        .from('video_render_jobs' as any)
        .update({ status: 'failed', error_message: 'Cancelled by user' } as any)
        .eq('id', jobId);
      
      setJobId(null);
    }
    
    setIsLoading(false);
    setProgress(0);
    toast.info("Export cancelled");
  };

  const exportVideo = async () => {
    if (overlays.length === 0) {
      toast.error("No content to export");
      return;
    }

    setIsLoading(true);
    setProgress(0);
    cancelExportRef.current = false;

    try {
      // Get user session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Please log in to export videos");
        setIsLoading(false);
        return;
      }

      console.log('Preparing composition for Remotion Cloud...');
      setProgress(5);

      // Prepare composition data for Remotion
      const compositionData = prepareCompositionData(
        overlays,
        durationInFrames,
        fps,
        1920, // Export at Full HD
        1080
      );

      const exportSettings = prepareExportSettings(
        { width: 1920, height: 1080 },
        'high'
      );

      // Create render job
      const { data: job, error: jobError } = await supabase
        .from('video_render_jobs' as any)
        .insert({
          user_id: session.user.id,
          status: 'queued',
          composition_data: compositionData,
          settings: exportSettings,
          progress: 5,
        } as any)
        .select()
        .single() as any;

      if (jobError) {
        throw new Error(`Failed to create render job: ${jobError.message}`);
      }

      setJobId(job.id);
      console.log('Sending to Remotion Cloud for rendering...');
      toast.info('Rendering video with Remotion Cloud for professional quality...');
      setProgress(10);

      // Call edge function to trigger Remotion Cloud rendering
      const { data: renderData, error: renderError } = await supabase.functions.invoke(
        'render-video-remotion',
        {
          body: {
            compositionData,
            settings: exportSettings,
            jobId: job.id,
          },
        }
      );

      if (renderError) {
        throw new Error(`Rendering failed: ${renderError.message}`);
      }

      if (!renderData?.success) {
        throw new Error(renderData?.error || 'Rendering failed - no data returned');
      }

      console.log('Render completed successfully:', renderData.videoUrl);
      toast.success('Video rendered successfully with professional quality!');
      setProgress(100);

      // Download the video
      const response = await fetch(renderData.videoUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `video-export-${Date.now()}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setIsLoading(false);
      setJobId(null);

    } catch (error) {
      console.error("Error exporting video:", error);
      
      // Update job as failed if we have a jobId
      if (jobId) {
        await supabase
          .from('video_render_jobs' as any)
          .update({
            status: 'failed',
            error_message: error instanceof Error ? error.message : 'Unknown error',
          } as any)
          .eq('id', jobId);
      }

      toast.error(error instanceof Error ? error.message : "Failed to export video");
      setIsLoading(false);
      setProgress(0);
      setJobId(null);
    }
  };

  return { exportVideo, cancelExport, progress, isLoading };
};
