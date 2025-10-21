import { useState, useCallback, useRef } from "react";
import { toast } from "sonner";
import { ExportSettings, Overlay } from "@/lib/video-editor/types";

export const useVideoExport = () => {
  const [progress, setProgress] = useState(0);
  const [isLoaded] = useState(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  const cancelExport = useCallback(() => {
    if (abortControllerRef.current) {
      console.log("Cancelling export...");
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setProgress(0);
      toast.info("Export cancelled");
    }
  }, []);

  const renderFrame = async (
    canvas: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D,
    overlays: Overlay[],
    frame: number,
    fps: number
  ): Promise<void> => {
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#111827';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const currentTime = frame / fps;

    // Render each overlay
    for (const overlay of overlays) {
      const startTime = overlay.from / fps;
      const endTime = (overlay.from + overlay.durationInFrames) / fps;

      if (currentTime >= startTime && currentTime < endTime) {
        const overlayTime = currentTime - startTime;

        if (overlay.type === 'video') {
          // Create video element if needed
          const video = document.createElement('video');
          video.src = overlay.src;
          video.currentTime = overlayTime + (overlay.videoStartTime || 0);
          
          await new Promise((resolve) => {
            video.addEventListener('seeked', () => resolve(null), { once: true });
          });

          ctx.save();
          ctx.translate(overlay.left + overlay.width / 2, overlay.top + overlay.height / 2);
          ctx.rotate((overlay.rotation || 0) * Math.PI / 180);
          ctx.drawImage(video, -overlay.width / 2, -overlay.height / 2, overlay.width, overlay.height);
          ctx.restore();
        } else if (overlay.type === 'image') {
          const img = new Image();
          img.src = overlay.src;
          await new Promise((resolve) => {
            img.onload = () => resolve(null);
          });

          ctx.save();
          ctx.translate(overlay.left + overlay.width / 2, overlay.top + overlay.height / 2);
          ctx.rotate((overlay.rotation || 0) * Math.PI / 180);
          ctx.drawImage(img, -overlay.width / 2, -overlay.height / 2, overlay.width, overlay.height);
          ctx.restore();
        } else if (overlay.type === 'text') {
          ctx.save();
          ctx.translate(overlay.left, overlay.top);
          ctx.rotate((overlay.rotation || 0) * Math.PI / 180);
          ctx.font = `${overlay.styles?.fontSize || 48}px ${overlay.styles?.fontFamily || 'Arial'}`;
          ctx.fillStyle = overlay.styles?.color || '#ffffff';
          ctx.textAlign = (overlay.styles?.textAlign as CanvasTextAlign) || 'left';
          ctx.fillText(overlay.content || '', 0, 0);
          ctx.restore();
        }
      }
    }
  };

  const exportVideo = useCallback(async (
    overlays: Overlay[],
    durationInFrames: number,
    fps: number,
    width: number,
    height: number,
    settings: ExportSettings,
    onProgress?: (progress: number) => void
  ): Promise<void> => {
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    try {
      console.log("Starting canvas-based export...", {
        durationInFrames,
        fps,
        width,
        height,
        overlaysCount: overlays.length,
        resolution: settings.resolution,
        quality: settings.quality,
      });

      setProgress(0);
      onProgress?.(0);
      toast.info("Preparing export...");

      // Create offscreen canvas
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        throw new Error("Could not get canvas context");
      }

      // Create MediaRecorder
      const stream = canvas.captureStream(fps);
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp9',
        videoBitsPerSecond: settings.quality === 'high' ? 8000000 : settings.quality === 'medium' ? 5000000 : 2500000,
      });

      const chunks: Blob[] = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      mediaRecorder.start();
      toast.info("Recording started...");

      // Render each frame
      for (let frame = 0; frame < durationInFrames; frame++) {
        if (signal.aborted) throw new Error("Export cancelled");

        await renderFrame(canvas, ctx, overlays, frame, fps);
        
        const progress = Math.round((frame / durationInFrames) * 100);
        setProgress(progress);
        onProgress?.(progress);

        // Wait for next frame
        await new Promise(resolve => setTimeout(resolve, 1000 / fps));
      }

      // Stop recording
      mediaRecorder.stop();

      await new Promise<void>((resolve) => {
        mediaRecorder.onstop = () => {
          const blob = new Blob(chunks, { type: 'video/webm' });
          const url = URL.createObjectURL(blob);
          
          const a = document.createElement('a');
          a.href = url;
          a.download = `video-export-${settings.resolution}-${Date.now()}.webm`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          
          URL.revokeObjectURL(url);
          
          setProgress(100);
          onProgress?.(100);
          toast.success("Video exported successfully!");
          resolve();
        };
      });

    } catch (error: any) {
      console.error("Export failed:", error);
      setProgress(0);
      onProgress?.(0);
      
      if (error?.message !== "Export cancelled") {
        toast.error(`Export failed: ${error?.message || "Unknown error"}`);
      }
      
      throw error;
    } finally {
      abortControllerRef.current = null;
    }
  }, []);

  return {
    exportVideo,
    cancelExport,
    progress,
    isLoaded,
  };
};
