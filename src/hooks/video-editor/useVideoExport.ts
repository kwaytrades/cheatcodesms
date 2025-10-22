import { useState } from "react";
import { Overlay } from "@/lib/video-editor/types";
import { prepareCompositionData } from "@/lib/video-editor/remotion-adapter";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const useVideoExport = (
  overlays: Overlay[],
  durationInFrames: number,
  fps: number,
  getAspectRatioDimensions: () => { width: number; height: number }
) => {
  const [progress, setProgress] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);

  const cancelExport = () => {
    setIsLoading(false);
    setProgress(0);
    setCurrentJobId(null);
    toast.error("Export cancelled");
  };

  const exportVideo = async (exportSettings: any) => {
    const toastId = "video-export";
    
    try {
      setIsLoading(true);
      setProgress(0);

      console.log('[Export] Starting server-side export with settings:', exportSettings);
      
      // Get composition dimensions
      const dimensions = getAspectRatioDimensions();
      console.log('[Export] Using dimensions:', dimensions);
      
      toast.loading("Preparing video for rendering...", { id: toastId });
      setProgress(5);
      
      // Prepare composition data for Remotion
      const compositionData = prepareCompositionData(
        overlays,
        durationInFrames,
        fps,
        dimensions.width,
        dimensions.height
      );

      // Create render job
      toast.loading("Creating render job...", { id: toastId });
      setProgress(10);

      const { data: jobData, error: jobError } = await supabase
        .from('video_render_jobs')
        .insert({
          composition_data: compositionData,
          settings: {
            width: dimensions.width,
            height: dimensions.height,
            quality: exportSettings.quality === 'high' ? 90 : exportSettings.quality === 'medium' ? 80 : 70,
          },
          status: 'pending',
        })
        .select()
        .single();

      if (jobError || !jobData) {
        throw new Error('Failed to create render job: ' + jobError?.message);
      }

      console.log('[Export] Render job created:', jobData.id);
      setCurrentJobId(jobData.id);

      // Call render-video-remotion edge function (non-blocking)
      toast.loading("Starting video render...", { id: toastId });
      setProgress(20);

      supabase.functions.invoke('render-video-remotion', {
        body: {
          compositionData,
          settings: {
            width: dimensions.width,
            height: dimensions.height,
            quality: exportSettings.quality === 'high' ? 90 : exportSettings.quality === 'medium' ? 80 : 70,
          },
          jobId: jobData.id,
        },
      }).catch(error => {
        console.error('[Export] Edge function invocation error:', error);
      });

      // Poll for job completion
      let pollAttempts = 0;
      const maxPollAttempts = 180; // 3 minutes with 1 second intervals
      
      while (pollAttempts < maxPollAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const { data: job, error: pollError } = await supabase
          .from('video_render_jobs')
          .select('*')
          .eq('id', jobData.id)
          .single();

        if (pollError) {
          console.error('[Export] Poll error:', pollError);
          pollAttempts++;
          continue;
        }

        // Update progress based on job status
        if (job.progress) {
          setProgress(Math.min(job.progress, 90));
          toast.loading(`Rendering video... ${job.progress}%`, { id: toastId });
        }

        if (job.status === 'completed' && job.video_url) {
          console.log('[Export] Render complete:', job.video_url);
          
          // Download the video
          toast.loading("Downloading video...", { id: toastId });
          setProgress(95);
          
          const response = await fetch(job.video_url);
          const blob = await response.blob();
          
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `video-export-${Date.now()}.mp4`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);

          setProgress(100);
          toast.success("Video exported successfully!", { id: toastId });
          setCurrentJobId(null);
          break;
        } else if (job.status === 'failed') {
          throw new Error(job.error_message || 'Render failed');
        }

        pollAttempts++;
      }

      if (pollAttempts >= maxPollAttempts) {
        throw new Error('Render timeout - the render is taking longer than expected. Please try again.');
      }
    } catch (error: any) {
      console.error('[Export] Error during export:', error);
      
      if (error?.message !== "Export cancelled") {
        toast.error(`Export failed: ${error.message}`, { id: toastId });
      }
      
      throw error;
    } finally {
      setIsLoading(false);
      setProgress(0);
      setCurrentJobId(null);
    }
  };

  return { exportVideo, cancelExport, progress, isLoading };
};
