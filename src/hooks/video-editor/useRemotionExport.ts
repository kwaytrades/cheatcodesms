import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Overlay, ExportSettings } from "@/lib/video-editor/types";
import { prepareCompositionData, prepareExportSettings } from "@/lib/video-editor/remotion-adapter";
import { toast } from "sonner";

export function useRemotionExport(
  overlays: Overlay[],
  durationInFrames: number,
  fps: number,
  getAspectRatioDimensions: () => { width: number; height: number }
) {
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);

  const exportVideo = useCallback(async (exportSettings: ExportSettings) => {
    setIsExporting(true);
    setProgress(0);

    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const dimensions = getAspectRatioDimensions();
      
      // Prepare composition data
      const compositionData = prepareCompositionData(
        overlays,
        durationInFrames,
        fps,
        dimensions.width,
        dimensions.height
      );

      // Prepare export settings
      const settings = prepareExportSettings(dimensions, exportSettings.quality);

      console.log('Creating render job...');
      
      // Create render job
      const { data: job, error: jobError } = await supabase
        .from('video_render_jobs')
        .insert([{
          user_id: user.id,
          composition_data: compositionData as any,
          settings: settings as any,
          status: 'queued',
          progress: 0
        }])
        .select()
        .single();

      if (jobError || !job) {
        throw new Error('Failed to create render job');
      }

      setCurrentJobId(job.id);
      console.log('Render job created:', job.id);

      // Trigger the render via edge function
      const { error: renderError } = await supabase.functions.invoke('render-video-remotion', {
        body: {
          compositionData,
          settings,
          jobId: job.id
        }
      });

      if (renderError) {
        throw new Error(`Render failed: ${renderError.message}`);
      }

      // Poll for job completion
      console.log('Polling for render completion...');
      let attempts = 0;
      const maxAttempts = 120; // 2 minutes with 1 second intervals

      while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const { data: updatedJob, error: pollError } = await supabase
          .from('video_render_jobs')
          .select('*')
          .eq('id', job.id)
          .single();

        if (pollError) {
          console.error('Poll error:', pollError);
          continue;
        }

        if (updatedJob) {
          setProgress(updatedJob.progress || 0);
          
          if (updatedJob.status === 'completed' && updatedJob.video_url) {
            console.log('Render completed! Downloading...', updatedJob.video_url);
            
            // Download the video
            const link = document.createElement('a');
            link.href = updatedJob.video_url;
            link.download = `video-export-${Date.now()}.mp4`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            setProgress(100);
            setIsExporting(false);
            setCurrentJobId(null);
            toast.success('Video downloaded successfully!');
            return;
          }
          
          if (updatedJob.status === 'failed') {
            throw new Error(updatedJob.error_message || 'Render failed');
          }
        }

        attempts++;
      }

      throw new Error('Render timeout - took longer than expected');

    } catch (error: any) {
      console.error('Export error:', error);
      setIsExporting(false);
      setProgress(0);
      setCurrentJobId(null);
      toast.error(error.message || 'Export failed');
      throw error;
    }
  }, [overlays, durationInFrames, fps, getAspectRatioDimensions]);

  const cancelExport = useCallback(() => {
    if (currentJobId) {
      // Update job status to cancelled
      supabase
        .from('video_render_jobs')
        .update({ status: 'failed', error_message: 'Cancelled by user' })
        .eq('id', currentJobId)
        .then(() => {
          console.log('Export cancelled');
        });
    }
    setIsExporting(false);
    setProgress(0);
    setCurrentJobId(null);
  }, [currentJobId]);

  return {
    exportVideo,
    cancelExport,
    isExporting,
    progress
  };
}
