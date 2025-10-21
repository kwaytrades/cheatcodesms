import { useState, useCallback, useRef } from "react";
import { toast } from "sonner";
import html2canvas from "html2canvas";
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

  const exportVideo = useCallback(async (
    playerRef: any,
    durationInFrames: number,
    fps: number,
    settings: ExportSettings,
    onProgress?: (progress: number) => void
  ): Promise<void> => {
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    let recordingCanvas: HTMLCanvasElement | null = null;
    let captureInterval: NodeJS.Timeout | null = null;

    try {
      const { width: targetWidth, height: targetHeight } = RESOLUTION_PRESETS[settings.resolution];
      const bitrate = BITRATE_PRESETS[settings.resolution][settings.quality];
      
      console.log("Starting frame-by-frame export...", { 
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

      // Get player container
      const container = playerRef.current?.getContainerNode();
      if (!container) {
        throw new Error("Player container not found");
      }

      // Find the player element (the div with the video rendering)
      const playerElement = container.querySelector('[data-remotion-canvas="true"]') || 
                           container.querySelector('div[style*="position"]') ||
                           container.firstElementChild;
      
      if (!playerElement) {
        throw new Error("Player rendering element not found");
      }

      console.log("Found player element for capture");

      // Create recording canvas
      recordingCanvas = document.createElement('canvas');
      recordingCanvas.width = targetWidth;
      recordingCanvas.height = targetHeight;
      const ctx = recordingCanvas.getContext('2d', { 
        alpha: false,
        desynchronized: true 
      });
      
      if (!ctx) {
        throw new Error("Failed to get 2D context for recording canvas");
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      console.log("Created recording canvas:", targetWidth, "x", targetHeight);

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
      toast.info("Capturing frames...");

      // Seek to start and pause
      const wasPlaying = playerRef.current?.isPlaying();
      playerRef.current?.pause();
      playerRef.current?.seekTo(0);
      await new Promise(resolve => setTimeout(resolve, 300));

      if (signal.aborted) throw new Error("Export cancelled");

      // Capture frames frame by frame
      const frameDelay = 1000 / fps;
      let currentFrame = 0;

      const captureFrame = async () => {
        if (signal.aborted || currentFrame >= durationInFrames) {
          return;
        }

        try {
          // Seek to current frame
          playerRef.current?.seekTo(currentFrame);
          await new Promise(resolve => setTimeout(resolve, 50)); // Wait for render

          // Capture the player element
          const canvas = await html2canvas(playerElement as HTMLElement, {
            backgroundColor: null,
            scale: targetWidth / (playerElement as HTMLElement).offsetWidth,
            logging: false,
            useCORS: true,
          });

          // Draw to recording canvas
          ctx.clearRect(0, 0, targetWidth, targetHeight);
          ctx.drawImage(canvas, 0, 0, targetWidth, targetHeight);

          // Update progress
          const progressPercent = Math.min(Math.round((currentFrame / durationInFrames) * 100), 99);
          setProgress(progressPercent);
          onProgress?.(progressPercent);

          currentFrame++;

          // Continue to next frame
          if (currentFrame < durationInFrames) {
            setTimeout(captureFrame, frameDelay);
          } else {
            // Finished capturing all frames
            console.log("All frames captured");
            mediaRecorder.stop();
          }
        } catch (error) {
          console.error("Error capturing frame:", error);
          mediaRecorder.stop();
        }
      };

      // Start capturing
      captureFrame();

      // Wait for recording to complete
      toast.info("Processing video...");
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

      if (captureInterval) {
        clearInterval(captureInterval);
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
      recordingCanvas = null;
    }
  }, []);

  return {
    exportVideo,
    cancelExport,
    progress,
    isLoaded,
  };
};
