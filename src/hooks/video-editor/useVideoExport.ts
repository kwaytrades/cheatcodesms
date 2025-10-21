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
          video.crossOrigin = 'anonymous';
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

      // Render the first frame to initialize the canvas
      renderFrame(canvas, ctx, overlays, 0, fps, videoAssets, imageAssets);
      
      // Create MediaRecorder with fallback MIME types
      const stream = canvas.captureStream(fps);
      
      // Verify stream has tracks
      if (stream.getTracks().length === 0) {
        throw new Error("Canvas stream has no tracks");
      }
      
      console.log("Stream tracks:", stream.getTracks().map(t => ({ kind: t.kind, enabled: t.enabled })));
      
      let mimeType = 'video/webm;codecs=vp9';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/webm;codecs=vp8';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = 'video/webm';
        }
      }
      
      console.log("Using MIME type:", mimeType);

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: settings.quality === 'high' ? 8000000 : settings.quality === 'medium' ? 5000000 : 2500000,
      });

      const chunks: Blob[] = [];
      mediaRecorder.ondataavailable = (e) => {
        console.log("Data available:", e.data.size, "bytes");
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };
      
      mediaRecorder.onerror = (e) => {
        console.error("MediaRecorder error:", e);
      };

      console.log("Starting MediaRecorder...");
      mediaRecorder.start(1000); // Request data every second for more reliable capture
      toast.info("Recording...");

      // Render frames using requestAnimationFrame for smooth capture
      let currentFrame = 1; // Start from 1 since we already rendered frame 0
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
          if (currentFrame % (fps * 2) === 0) { // Request every 2 seconds
            console.log("Requesting data at frame", currentFrame);
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

      // Request final data and stop recording
      console.log("Requesting final data before stop...");
      mediaRecorder.requestData();
      
      await new Promise<void>((resolve) => {
        mediaRecorder.onstop = () => {
          console.log("MediaRecorder stopped");
          // Wait for all pending data chunks to arrive
          setTimeout(() => {
            console.log(`Creating blob from ${chunks.length} chunks`);
            const blob = new Blob(chunks, { type: 'video/webm' });
            console.log(`Blob size: ${blob.size} bytes`);
            
            if (blob.size === 0) {
              console.error("No video data captured - chunks array was empty");
              toast.error("Export failed: No video data captured");
              resolve();
              return;
            }
            
            const url = URL.createObjectURL(blob);
            console.log("Created blob URL:", url);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = `video-export-${settings.resolution}-${Date.now()}.webm`;
            document.body.appendChild(a);
            console.log("Triggering download...");
            a.click();
            document.body.removeChild(a);
            
            URL.revokeObjectURL(url);
            
            setProgress(100);
            onProgress?.(100);
            toast.success("Video exported successfully!");
            resolve();
          }, 1000); // Increased timeout to 1 second
        };
        
        console.log("Stopping MediaRecorder...");
        mediaRecorder.stop();
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
