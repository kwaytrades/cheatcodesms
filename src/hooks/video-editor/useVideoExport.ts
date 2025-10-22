import { useState, useEffect, useRef } from "react";
import { Overlay } from "@/lib/video-editor/types";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { prepareCompositionData, prepareExportSettings } from "@/lib/video-editor/remotion-adapter";
import type { VideoRenderJob } from "@/lib/video-editor/supabase-types";

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
          console.log('Job update:', job);
          
          setProgress(job.progress || 0);
          
          if (job.status === 'completed' && job.video_url) {
            setIsLoading(false);
            setJobId(null);
            
            // Download the video
            const link = document.createElement('a');
            link.href = job.video_url;
            link.download = `video-${Date.now()}.mp4`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            toast.success('Video exported successfully!');
          } else if (job.status === 'failed') {
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
        return;
      }

      console.log('Preparing composition data...');
      setProgress(5);

      // Prepare composition data
      const compositionData = prepareCompositionData(
        overlays,
        durationInFrames,
        fps,
        playerDimensions.width,
        playerDimensions.height
      );

      // Prepare export settings
      const settings = prepareExportSettings(
        playerDimensions,
        'high'
      );

      console.log('Creating render job...');

      // Create a render job using raw query to bypass type checking
      const { data: job, error: jobError } = await supabase
        .from('video_render_jobs' as any)
        .insert({
          user_id: session.user.id,
          status: 'queued',
          composition_data: compositionData,
          settings: settings,
          progress: 0,
        } as any)
        .select()
        .single() as any;

      if (jobError) {
        throw new Error(`Failed to create render job: ${jobError.message}`);
      }

      console.log('Render job created:', job.id);
      setJobId(job.id);
      setProgress(10);

      // Call the edge function to start rendering
      const { error: renderError } = await supabase.functions.invoke('render-video-mp4', {
        body: {
          compositionData,
          settings,
          jobId: job.id,
        },
      });

      if (renderError) {
        throw new Error(`Failed to start render: ${renderError.message}`);
      }

      console.log('Render started, waiting for completion...');
      toast.info('Video rendering started. This may take a few minutes...');

    } catch (error) {
      console.error("Error exporting video:", error);
      toast.error(error instanceof Error ? error.message : "Failed to export video");
      setIsLoading(false);
      setProgress(0);
      setJobId(null);
    }
  };

  return { exportVideo, cancelExport, progress, isLoading };
};
