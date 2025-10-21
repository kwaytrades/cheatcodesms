import { useState, useCallback, useRef } from "react";
import { toast } from "sonner";
import { ExportSettings, RESOLUTION_PRESETS, QUALITY_PRESETS } from "@/lib/video-editor/types";

// Bitrate presets for MediaRecorder (in bits per second)
const BITRATE_PRESETS = {
  "4K": {
    high: 25_000_000,    // 25 Mbps
    medium: 15_000_000,  // 15 Mbps
    low: 8_000_000,      // 8 Mbps
  },
  "1080p": {
    high: 10_000_000,    // 10 Mbps
    medium: 5_000_000,   // 5 Mbps
    low: 2_500_000,      // 2.5 Mbps
  },
  "720p": {
    high: 5_000_000,     // 5 Mbps
    medium: 2_500_000,   // 2.5 Mbps
    low: 1_500_000,      // 1.5 Mbps
  },
};

export const useVideoExport = () => {
  const [progress, setProgress] = useState(0);
  const [isLoaded] = useState(true); // MediaRecorder is always available
  const abortControllerRef = useRef<AbortController | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  const cancelExport = useCallback(() => {
    if (abortControllerRef.current) {
      console.log("Cancelling export...");
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
      mediaRecorderRef.current = null;
      
      setProgress(0);
      toast.info("Export cancelled");
    }
  }, []);

  const createScaledCanvas = (sourceCanvas: HTMLCanvasElement, targetWidth: number, targetHeight: number): HTMLCanvasElement => {
    const scaledCanvas = document.createElement('canvas');
    scaledCanvas.width = targetWidth;
    scaledCanvas.height = targetHeight;
    
    const ctx = scaledCanvas.getContext('2d', { 
      alpha: false,
      desynchronized: true 
    });
    
    if (!ctx) {
      throw new Error("Failed to get 2D context for scaled canvas");
    }

    // Use high-quality scaling
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    
    return scaledCanvas;
  };

  const exportVideo = useCallback(async (
    playerRef: any,
    durationInFrames: number,
    fps: number,
    settings: ExportSettings,
    onProgress?: (progress: number) => void
  ): Promise<void> => {
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    let scaledCanvas: HTMLCanvasElement | null = null;
    let animationFrameId: number | null = null;

    try {
      const { width: targetWidth, height: targetHeight } = RESOLUTION_PRESETS[settings.resolution];
      const bitrate = BITRATE_PRESETS[settings.resolution][settings.quality];
      
      console.log("Starting MediaRecorder export...", { 
        durationInFrames, 
        fps, 
        targetWidth, 
        targetHeight,
        resolution: settings.resolution,
        quality: settings.quality,
        bitrate: `${(bitrate / 1_000_000).toFixed(1)} Mbps`,
      });
      
      setProgress(0);
      onProgress?.(0);

      // Get canvas from player
      const container = playerRef.current?.getContainerNode();
      if (!container) {
        throw new Error("Player container not found");
      }

      const sourceCanvas = container.querySelector("canvas") as HTMLCanvasElement;
      if (!sourceCanvas) {
        throw new Error("Canvas not found in player");
      }

      if (sourceCanvas.width === 0 || sourceCanvas.height === 0) {
        throw new Error("Canvas has no dimensions - try playing the video first");
      }

      console.log("Source canvas dimensions:", sourceCanvas.width, "x", sourceCanvas.height);
      console.log("Target dimensions:", targetWidth, "x", targetHeight);

      // Pause playback and seek to start
      const wasPlaying = playerRef.current?.isPlaying();
      if (wasPlaying) {
        playerRef.current?.pause();
      }
      playerRef.current?.seekTo(0);
      await new Promise(resolve => setTimeout(resolve, 100));

      if (signal.aborted) throw new Error("Export cancelled");

      // Determine if we need to scale
      const needsScaling = sourceCanvas.width !== targetWidth || sourceCanvas.height !== targetHeight;
      let recordingCanvas = sourceCanvas;
      
      if (needsScaling) {
        console.log("Creating scaled canvas for recording...");
        scaledCanvas = createScaledCanvas(sourceCanvas, targetWidth, targetHeight);
        recordingCanvas = scaledCanvas;
      }

      // Get supported MIME types
      const mimeTypes = [
        'video/webm;codecs=vp9',
        'video/webm;codecs=vp8',
        'video/webm',
      ];
      
      const mimeType = mimeTypes.find(type => MediaRecorder.isTypeSupported(type)) || 'video/webm';
      console.log("Using MIME type:", mimeType);

      // Create MediaStream from canvas
      const stream = recordingCanvas.captureStream(fps);
      console.log("Created canvas stream at", fps, "FPS");

      // Set up MediaRecorder
      const chunks: Blob[] = [];
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: bitrate,
      });
      
      mediaRecorderRef.current = mediaRecorder;

      // Collect data chunks
      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunks.push(event.data);
          console.log("Received chunk:", event.data.size, "bytes");
        }
      };

      // Handle recording completion
      const recordingComplete = new Promise<Blob>((resolve, reject) => {
        mediaRecorder.onstop = () => {
          console.log("Recording stopped, total chunks:", chunks.length);
          if (chunks.length === 0) {
            reject(new Error("No video data recorded"));
            return;
          }
          const blob = new Blob(chunks, { type: mimeType });
          console.log("Created blob:", blob.size, "bytes");
          resolve(blob);
        };

        mediaRecorder.onerror = (event: any) => {
          console.error("MediaRecorder error:", event);
          reject(new Error(`Recording failed: ${event.error?.message || "Unknown error"}`));
        };
      });

      // Start recording
      console.log("Starting MediaRecorder...");
      mediaRecorder.start(100); // Collect data every 100ms
      toast.info("Recording video...");

      // If we're scaling, continuously copy source to scaled canvas
      if (needsScaling && scaledCanvas) {
        const ctx = scaledCanvas.getContext('2d');
        if (!ctx) throw new Error("Failed to get scaled canvas context");

        const updateScaledCanvas = () => {
          if (signal.aborted) return;
          ctx.drawImage(sourceCanvas, 0, 0, targetWidth, targetHeight);
          animationFrameId = requestAnimationFrame(updateScaledCanvas);
        };
        updateScaledCanvas();
      }

      // Play through the timeline and track progress
      const startTime = Date.now();
      const durationInSeconds = durationInFrames / fps;
      
      playerRef.current?.play();

      // Progress tracking interval
      const progressInterval = setInterval(() => {
        if (signal.aborted) {
          clearInterval(progressInterval);
          return;
        }

        const currentFrame = playerRef.current?.getCurrentFrame() || 0;
        const progressPercent = Math.min(Math.round((currentFrame / durationInFrames) * 100), 99);
        setProgress(progressPercent);
        onProgress?.(progressPercent);
      }, 100);

      // Wait for video to finish playing
      await new Promise<void>((resolve) => {
        const checkProgress = () => {
          if (signal.aborted) {
            clearInterval(progressInterval);
            resolve();
            return;
          }

          const currentFrame = playerRef.current?.getCurrentFrame() || 0;
          
          if (currentFrame >= durationInFrames - 1) {
            clearInterval(progressInterval);
            resolve();
          } else {
            setTimeout(checkProgress, 50);
          }
        };
        checkProgress();
      });

      clearInterval(progressInterval);

      if (signal.aborted) throw new Error("Export cancelled");

      // Stop recording
      console.log("Stopping recording...");
      mediaRecorder.stop();
      
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
      }

      // Wait for recording to finalize
      toast.info("Finalizing video...");
      setProgress(95);
      onProgress?.(95);
      
      const videoBlob = await recordingComplete;
      
      if (signal.aborted) throw new Error("Export cancelled");

      // Download the file
      console.log("Downloading video...");
      const url = URL.createObjectURL(videoBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `video-export-${settings.resolution}-${Date.now()}.webm`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setProgress(100);
      onProgress?.(100);
      toast.success("Video exported successfully!");
      console.log("Export complete!");

      // Restore playback state
      playerRef.current?.pause();
      playerRef.current?.seekTo(0);
      if (wasPlaying) {
        playerRef.current?.play();
      }
    } catch (error: any) {
      console.error("Export failed:", error);
      
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
      }

      setProgress(0);
      onProgress?.(0);
      
      if (error?.message !== "Export cancelled") {
        toast.error(`Export failed: ${error?.message || "Unknown error"}`);
      }
      
      throw error;
    } finally {
      mediaRecorderRef.current = null;
      abortControllerRef.current = null;
      scaledCanvas = null;
    }
  }, []);

  return {
    exportVideo,
    cancelExport,
    progress,
    isLoaded,
  };
};
