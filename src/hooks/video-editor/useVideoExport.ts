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

  const preloadAssets = async (
    overlays: Overlay[]
  ): Promise<{ videos: Map<number, HTMLVideoElement>; images: Map<number, HTMLImageElement> }> => {
    const videos = new Map<number, HTMLVideoElement>();
    const images = new Map<number, HTMLImageElement>();

    const loadPromises: Promise<void>[] = [];

    overlays.forEach((overlay) => {
      if (overlay.type === 'video') {
        const promise = new Promise<void>((resolve, reject) => {
          const video = document.createElement('video');
          video.src = overlay.src;
          video.preload = 'auto';
          video.muted = true;
          video.onloadeddata = () => {
            videos.set(overlay.id, video);
            resolve();
          };
          video.onerror = () => reject(new Error(`Failed to load video: ${overlay.src}`));
        });
        loadPromises.push(promise);
      } else if (overlay.type === 'image') {
        const promise = new Promise<void>((resolve, reject) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => {
            images.set(overlay.id, img);
            resolve();
          };
          img.onerror = () => reject(new Error(`Failed to load image: ${overlay.src}`));
          img.src = overlay.src;
        });
        loadPromises.push(promise);
      }
    });

    await Promise.all(loadPromises);
    return { videos, images };
  };

  const renderFrame = (
    canvas: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D,
    overlays: Overlay[],
    frame: number,
    fps: number,
    videoAssets: Map<number, HTMLVideoElement>,
    imageAssets: Map<number, HTMLImageElement>
  ): void => {
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
          const video = videoAssets.get(overlay.id);
          if (video) {
            video.currentTime = overlayTime + (overlay.videoStartTime || 0);
            ctx.save();
            ctx.translate(overlay.left + overlay.width / 2, overlay.top + overlay.height / 2);
            ctx.rotate((overlay.rotation || 0) * Math.PI / 180);
            ctx.drawImage(video, -overlay.width / 2, -overlay.height / 2, overlay.width, overlay.height);
            ctx.restore();
          }
        } else if (overlay.type === 'image') {
          const img = imageAssets.get(overlay.id);
          if (img) {
            ctx.save();
            ctx.translate(overlay.left + overlay.width / 2, overlay.top + overlay.height / 2);
            ctx.rotate((overlay.rotation || 0) * Math.PI / 180);
            ctx.drawImage(img, -overlay.width / 2, -overlay.height / 2, overlay.width, overlay.height);
            ctx.restore();
          }
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
      toast.info("Loading assets...");

      // Pre-load all media assets
      const { videos: videoAssets, images: imageAssets } = await preloadAssets(overlays);
      
      toast.info("Preparing canvas...");

      // Create offscreen canvas
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        throw new Error("Could not get canvas context");
      }

      // Create MediaRecorder with fallback MIME types
      const stream = canvas.captureStream(fps);
      let mimeType = 'video/webm;codecs=vp9';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/webm;codecs=vp8';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = 'video/webm';
        }
      }

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: settings.quality === 'high' ? 8000000 : settings.quality === 'medium' ? 5000000 : 2500000,
      });

      const chunks: Blob[] = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      mediaRecorder.start(100); // Request data every 100ms
      toast.info("Recording...");

      // Render frames using requestAnimationFrame for smooth capture
      let currentFrame = 0;
      const startTime = performance.now();
      const frameDuration = 1000 / fps;

      await new Promise<void>((resolve, reject) => {
        const renderNextFrame = () => {
          if (signal.aborted) {
            reject(new Error("Export cancelled"));
            return;
          }

          if (currentFrame >= durationInFrames) {
            resolve();
            return;
          }

          // Render the current frame
          renderFrame(canvas, ctx, overlays, currentFrame, fps, videoAssets, imageAssets);
          
          // Update progress
          const progress = Math.round((currentFrame / durationInFrames) * 100);
          setProgress(progress);
          onProgress?.(progress);

          // Request data periodically to ensure chunks are captured
          if (currentFrame % 30 === 0) {
            mediaRecorder.requestData();
          }

          currentFrame++;

          // Calculate when the next frame should be rendered
          const elapsedTime = performance.now() - startTime;
          const expectedTime = currentFrame * frameDuration;
          const delay = Math.max(0, expectedTime - elapsedTime);

          setTimeout(() => {
            requestAnimationFrame(renderNextFrame);
          }, delay);
        };

        requestAnimationFrame(renderNextFrame);
      });

      // Stop recording and request final data
      mediaRecorder.requestData();
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
