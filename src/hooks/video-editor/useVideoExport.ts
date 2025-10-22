import { useState, useRef } from "react";
import { Overlay } from "@/lib/video-editor/types";
import { toast } from "sonner";
import { CanvasRenderer } from "@/lib/video-editor/canvas-renderer";

export const useVideoExport = (
  overlays: Overlay[],
  durationInFrames: number,
  fps: number,
  playerDimensions: { width: number; height: number }
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

      // Create canvas renderer
      const renderer = new CanvasRenderer(playerDimensions.width, playerDimensions.height);
      
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

      mediaRecorder.onstop = () => {
        if (cancelExportRef.current) {
          renderer.destroy();
          return;
        }

        const blob = new Blob(chunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        
        // Download the video
        const link = document.createElement('a');
        link.href = url;
        link.download = `video-export-${Date.now()}.webm`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        URL.revokeObjectURL(url);
        renderer.destroy();
        
        toast.success("Video exported successfully!", { id: toastId });
        setIsLoading(false);
        setProgress(100);
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
        
        // Update progress (15% to 95%)
        const frameProgress = 15 + ((frame / totalFrames) * 80);
        setProgress(Math.round(frameProgress));
        
        // Wait for next frame time
        await new Promise(resolve => setTimeout(resolve, frameInterval));
      }

      toast.loading("Finalizing video...", { id: toastId });
      setProgress(95);
      
      // Stop recording
      mediaRecorder.stop();

    } catch (error) {
      console.error("Error exporting video:", error);
      toast.error(error instanceof Error ? error.message : "Failed to export video", { id: toastId });
      setIsLoading(false);
      setProgress(0);
    }
  };

  return { exportVideo, cancelExport, progress, isLoading };
};
