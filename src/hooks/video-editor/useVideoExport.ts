import { useState, useCallback, useEffect } from 'react';
import { Overlay, ExportSettings } from '@/lib/video-editor/types';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const useVideoExport = () => {
  const [progress, setProgress] = useState(0);
  const [isLoaded] = useState(true);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  // Setup realtime subscription for job progress
  useEffect(() => {
    if (!currentJobId) return;

    console.log('Setting up realtime subscription for job:', currentJobId);

    const channel = supabase
      .channel(`render-job-${currentJobId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'video_render_jobs',
          filter: `id=eq.${currentJobId}`,
        },
        (payload) => {
          const job = payload.new as any;
          console.log('Job update:', job);
          
          setProgress(job.progress || 0);
          
          if (job.status === 'done') {
            console.log('Render complete!');
            if (job.error_message) {
              toast.info(job.error_message);
            } else {
              toast.success('Video rendered successfully!');
            }
            setIsExporting(false);
            setCurrentJobId(null);
            setProgress(100);
          } else if (job.status === 'error') {
            console.error('Render failed:', job.error_message);
            toast.error(`Render failed: ${job.error_message || 'Unknown error'}`);
            setIsExporting(false);
            setCurrentJobId(null);
            setProgress(0);
          }
        }
      )
      .subscribe((status) => {
        console.log('Subscription status:', status);
      });

    return () => {
      console.log('Cleaning up realtime subscription');
      supabase.removeChannel(channel);
    };
  }, [currentJobId]);

  const cancelExport = useCallback(() => {
    if (currentJobId) {
      console.log('Cancelling export job:', currentJobId);
      setIsExporting(false);
      setCurrentJobId(null);
      setProgress(0);
      toast.info('Export cancelled');
    }
  }, [currentJobId]);

  const exportVideo = useCallback(async (
    overlays: Overlay[],
    durationInFrames: number,
    fps: number,
    width: number,
    height: number,
    settings: ExportSettings,
    onProgress?: (progress: number) => void
  ) => {
    try {
      setIsExporting(true);
      setProgress(0);
      onProgress?.(0);

      console.log('Starting server-side video render:', { width, height, fps, durationInFrames });
      toast.info('Submitting render job...');

      // Call render-video edge function
      const { data, error } = await supabase.functions.invoke('render-video', {
        body: {
          composition: {
            overlays,
            width,
            height,
            fps,
            durationInFrames,
          },
          settings: {
            quality: settings.quality || 'high',
            resolution: settings.resolution || '1080p',
            codec: 'h264',
          },
        },
      });

      if (error) {
        throw new Error(`Failed to start render: ${error.message}`);
      }

      const { jobId } = data;
      console.log('Render job created:', jobId);
      
      toast.success('Render job started!');
      setCurrentJobId(jobId);
      
      // Realtime subscription will handle progress updates
      // Job completion will be handled in the useEffect

    } catch (error: any) {
      console.error('Export error:', error);
      toast.error(`Export failed: ${error.message || 'Unknown error'}`);
      setIsExporting(false);
      setCurrentJobId(null);
      setProgress(0);
      onProgress?.(0);
      throw error;
    }
  }, []);

  return {
    exportVideo,
    cancelExport,
    progress,
    isLoaded,
  };
};
