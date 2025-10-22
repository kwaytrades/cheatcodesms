import { useState, useEffect, useRef } from "react";
import { Overlay } from "@/lib/video-editor/types";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { VideoRenderJob } from "@/lib/video-editor/supabase-types";
import { CanvasRenderer } from "@/lib/video-editor/canvas-renderer";

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

    let renderer: CanvasRenderer | null = null;
    let mediaRecorder: MediaRecorder | null = null;
    let recordedChunks: Blob[] = [];

    try {
      // Get user session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Please log in to export videos");
        setIsLoading(false);
        return;
      }

      console.log('Creating render job...');
      setProgress(5);

      // Create a render job
      const { data: job, error: jobError } = await supabase
        .from('video_render_jobs' as any)
        .insert({
          user_id: session.user.id,
          status: 'rendering',
          composition_data: { overlays, durationInFrames, fps },
          settings: { width: playerDimensions.width, height: playerDimensions.height },
          progress: 5,
        } as any)
        .select()
        .single() as any;

      if (jobError) {
        throw new Error(`Failed to create render job: ${jobError.message}`);
      }

      setJobId(job.id);
      console.log('Starting client-side rendering...');
      toast.info('Rendering video with high quality settings...');

      // Initialize canvas renderer
      renderer = new CanvasRenderer(playerDimensions.width, playerDimensions.height);
      setProgress(10);

      // Preload all assets
      console.log('Preloading assets...');
      await renderer.preloadAssets(overlays);
      setProgress(15);

      if (cancelExportRef.current) {
        throw new Error('Export cancelled');
      }

      // Set up MediaRecorder with high-quality settings
      const canvas = renderer.getCanvas();
      const stream = canvas.captureStream(fps);

      // Use highest quality WebM codec available
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : MediaRecorder.isTypeSupported('video/webm;codecs=vp8')
        ? 'video/webm;codecs=vp8'
        : 'video/webm';

      mediaRecorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: 20000000, // 20 Mbps for very high quality
      });

      recordedChunks = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          recordedChunks.push(e.data);
        }
      };

      // Start recording
      mediaRecorder.start(100); // Capture every 100ms

      // Render frames
      const totalFrames = durationInFrames;
      const frameDelay = 1000 / fps;

      for (let frame = 0; frame < totalFrames; frame++) {
        if (cancelExportRef.current) {
          throw new Error('Export cancelled');
        }

        await renderer.renderFrame(overlays, frame, fps);
        
        // Update progress (15-85% during rendering)
        const renderProgress = 15 + Math.floor((frame / totalFrames) * 70);
        setProgress(renderProgress);

        // Update job progress in database every 10 frames
        if (frame % 10 === 0) {
          await supabase
            .from('video_render_jobs' as any)
            .update({ progress: renderProgress } as any)
            .eq('id', job.id);
        }

        // Wait for next frame timing
        await new Promise(resolve => setTimeout(resolve, frameDelay));
      }

      // Stop recording
      await new Promise<void>((resolve) => {
        if (!mediaRecorder) {
          resolve();
          return;
        }
        mediaRecorder.onstop = () => resolve();
        mediaRecorder.stop();
      });

      console.log('Recording complete, finalizing high-quality WebM...');
      setProgress(85);

      // Create high-quality WebM blob
      const finalBlob = new Blob(recordedChunks, { type: mimeType });
      const finalExtension = 'webm';
      
      console.log(`WebM created: ${finalBlob.size} bytes at 20 Mbps`);
      setProgress(92);

      // Upload to Supabase Storage with user ID folder
      const fileName = `${session.user.id}/${job.id}.${finalExtension}`;
      const { error: uploadError } = await supabase.storage
        .from('content-videos')
        .upload(fileName, finalBlob, {
          contentType: 'video/webm',
          upsert: true,
        });

      if (uploadError) {
        throw new Error(`Failed to upload video: ${uploadError.message}`);
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('content-videos')
        .getPublicUrl(fileName);

      // Update job as completed
      await supabase
        .from('video_render_jobs' as any)
        .update({
          status: 'completed',
          video_url: publicUrl,
          progress: 100,
        } as any)
        .eq('id', job.id);

      setProgress(100);
      
      // Trigger local download immediately
      const downloadUrl = URL.createObjectURL(finalBlob);
      const downloadLink = document.createElement('a');
      downloadLink.href = downloadUrl;
      downloadLink.download = `video-export-${Date.now()}.webm`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
      
      // Cleanup
      setTimeout(() => URL.revokeObjectURL(downloadUrl), 100);
      
      console.log(`High-quality WebM export complete! Size: ${(finalBlob.size / 1024 / 1024).toFixed(2)}MB`);
      toast.success('High-quality video exported successfully!');

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
    } finally {
      // Cleanup
      if (renderer) {
        renderer.destroy();
      }
      if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
      }
    }
  };

  return { exportVideo, cancelExport, progress, isLoading };
};
