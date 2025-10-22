import { useState, useRef } from "react";
import { Overlay } from "@/lib/video-editor/types";
import { toast } from "sonner";
import { CanvasRenderer } from "@/lib/video-editor/canvas-renderer";
import { convertWebMToMP4 } from "@/lib/video-editor/ffmpeg-converter";

export const useVideoExport = (
  overlays: Overlay[],
  durationInFrames: number,
  fps: number,
  getAspectRatioDimensions: () => { width: number; height: number }
) => {
  const [progress, setProgress] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const cancelExportRef = useRef(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  const cancelExport = () => {
    cancelExportRef.current = true;
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
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

    const toastId = toast.loading("Preparing export...");

    try {
      console.log('Starting client-side video export...');
      setProgress(5);

      // Get composition dimensions (always even numbers for H.264 compatibility)
      const compositionDimensions = getAspectRatioDimensions();
      console.log('[Export] Using composition dimensions:', compositionDimensions);
      
      // Create canvas renderer with proper dimensions
      const renderer = new CanvasRenderer(compositionDimensions.width, compositionDimensions.height);
      
      toast.loading("Loading assets...", { id: toastId });
      setProgress(10);
      
      // Preload all assets
      await renderer.preloadAssets(overlays);
      
      if (cancelExportRef.current) {
        renderer.destroy();
        return;
      }

      toast.loading("Starting recording...", { id: toastId });
      setProgress(15);

      // Get canvas and create stream
      const canvas = renderer.getCanvas();
      const stream = canvas.captureStream(fps);

      // Add audio tracks if any
      const audioElements = renderer.getAudioElements();
      if (audioElements.size > 0) {
        const audioContext = new AudioContext({ sampleRate: 48000 });
        const destination = audioContext.createMediaStreamDestination();
        
        for (const audio of audioElements.values()) {
          const source = audioContext.createMediaElementSource(audio);
          source.connect(destination);
        }
        
        destination.stream.getAudioTracks().forEach(track => {
          stream.addTrack(track);
        });
      }

      // Setup MediaRecorder
      const chunks: Blob[] = [];
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp9',
        videoBitsPerSecond: 8000000, // 8 Mbps for high quality
      });
      
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        console.log('[Export] MediaRecorder stopped');
        
        if (cancelExportRef.current) {
          console.log('[Export] Export was cancelled');
          renderer.destroy();
          return;
        }

        try {
          console.log('[Export] Creating WebM blob from', chunks.length, 'chunks');
          const webmBlob = new Blob(chunks, { type: 'video/webm' });
          console.log('[Export] WebM blob created, size:', webmBlob.size, 'bytes');

          if (webmBlob.size === 0) {
            throw new Error('Recording produced an empty file');
          }
          
          toast.loading("Converting to MP4...", { id: toastId });
          setProgress(50);
          console.log('[Export] Starting MP4 conversion...');

          try {
            // Add timeout for conversion
            const conversionTimeout = 120000; // 2 minutes
            const conversionPromise = convertWebMToMP4(webmBlob, (conversionProgress) => {
              console.log('[Export] Conversion progress:', Math.round(conversionProgress * 100) + '%');
              const totalProgress = 50 + (conversionProgress * 0.45);
              setProgress(Math.round(totalProgress));
            });

            const timeoutPromise = new Promise<never>((_, reject) => {
              setTimeout(() => reject(new Error('Conversion timeout after 2 minutes')), conversionTimeout);
            });

            const mp4Blob = await Promise.race([conversionPromise, timeoutPromise]);
            console.log('[Export] MP4 conversion complete, size:', mp4Blob.size, 'bytes');

            if (mp4Blob.size === 0) {
              throw new Error('Conversion produced an empty MP4 file');
            }

            if (cancelExportRef.current) {
              console.log('[Export] Export was cancelled after conversion');
              renderer.destroy();
              return;
            }

            console.log('[Export] Preparing download...');
            toast.loading("Preparing download...", { id: toastId });
            setProgress(95);

            // Download the MP4
            console.log('[Export] Creating download URL...');
            const url = URL.createObjectURL(mp4Blob);
            console.log('[Export] Creating download link...');
            const link = document.createElement('a');
            link.href = url;
            link.download = `video-export-${Date.now()}.mp4`;
            document.body.appendChild(link);
            console.log('[Export] Triggering download...');
            link.click();
            
            // Cleanup after a short delay to ensure download starts
            setTimeout(() => {
              console.log('[Export] Cleaning up download resources...');
              document.body.removeChild(link);
              URL.revokeObjectURL(url);
            }, 100);
            
            renderer.destroy();
            console.log('[Export] Export completed successfully!');
            
            toast.success("Video exported successfully as MP4!", { id: toastId });
            setIsLoading(false);
            setProgress(100);
          } catch (conversionError) {
            console.error('[Export] MP4 conversion failed:', conversionError);
            console.error('[Export] Error details:', {
              message: conversionError instanceof Error ? conversionError.message : 'Unknown error',
              stack: conversionError instanceof Error ? conversionError.stack : undefined
            });
            
            // Fallback: Download WebM file
            console.log('[Export] Falling back to WebM download...');
            toast.loading("Conversion failed, downloading as WebM...", { id: toastId });
            
            const url = URL.createObjectURL(webmBlob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `video-export-${Date.now()}.webm`;
            document.body.appendChild(link);
            link.click();
            
            setTimeout(() => {
              document.body.removeChild(link);
              URL.revokeObjectURL(url);
            }, 100);
            
            renderer.destroy();
            console.log('[Export] WebM download completed');
            
            toast.error("MP4 conversion failed. Downloaded as WebM instead.", { id: toastId });
            setIsLoading(false);
            setProgress(100);
          }
        } catch (error) {
          console.error('[Export] Recording error:', error);
          console.error('[Export] Error details:', {
            message: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined
          });
          toast.error(error instanceof Error ? error.message : "Failed to complete export", { id: toastId });
          renderer.destroy();
          setIsLoading(false);
          setProgress(0);
        }
      };

      mediaRecorder.onerror = (e) => {
        console.error('MediaRecorder error:', e);
        toast.error("Recording failed", { id: toastId });
        renderer.destroy();
        setIsLoading(false);
      };

      // Start recording
      mediaRecorder.start();
      
      toast.loading("Rendering frames...", { id: toastId });

      // Render all frames
      const totalFrames = durationInFrames;
      const frameInterval = 1000 / fps;
      
      for (let frame = 0; frame < totalFrames; frame++) {
        if (cancelExportRef.current) {
          mediaRecorder.stop();
          renderer.destroy();
          return;
        }

        await renderer.renderFrame(overlays, frame, fps);
        
        // Update progress (15% to 45% for recording phase)
        const frameProgress = 15 + ((frame / totalFrames) * 30);
        setProgress(Math.round(frameProgress));
        
        // Wait for next frame time
        await new Promise(resolve => setTimeout(resolve, frameInterval));
      }

      toast.loading("Finalizing video...", { id: toastId });
      setProgress(45);
      
      // Stop recording (this triggers conversion in onstop handler)
      mediaRecorder.stop();
      stream.getTracks().forEach(track => track.stop());

    } catch (error) {
      console.error("Error exporting video:", error);
      toast.error(error instanceof Error ? error.message : "Failed to export video", { id: toastId });
      setIsLoading(false);
      setProgress(0);
    }
  };

  return { exportVideo, cancelExport, progress, isLoading };
};
