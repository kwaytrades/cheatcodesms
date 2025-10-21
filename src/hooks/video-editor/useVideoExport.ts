import { useState, useCallback, useRef } from "react";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";
import { toast } from "sonner";
import { ExportSettings, RESOLUTION_PRESETS, QUALITY_PRESETS } from "@/lib/video-editor/types";

export const useVideoExport = () => {
  const [ffmpeg] = useState(() => new FFmpeg());
  const [isLoaded, setIsLoaded] = useState(false);
  const [progress, setProgress] = useState(0);
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

  const loadFFmpeg = useCallback(async (signal: AbortSignal) => {
    if (isLoaded) {
      console.log("FFmpeg already loaded");
      return;
    }

    try {
      toast.info("Loading video encoder...");
      const baseURL = "/ffmpeg-core";
      
      console.log("Loading FFmpeg from local files:", baseURL);
      
      // Check if cancelled
      if (signal.aborted) {
        throw new Error("Export cancelled");
      }

      // Set up event listeners before loading
      ffmpeg.on("progress", ({ progress: p }) => {
        const progressPercent = Math.round(p * 100);
        console.log("FFmpeg encoding progress:", progressPercent);
        setProgress(50 + Math.round(p * 40)); // 50-90% for encoding
      });
      
      ffmpeg.on("log", ({ message }) => {
        console.log("FFmpeg log:", message);
      });

      // Load with timeout
      const loadPromise = ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
      });

      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("FFmpeg loading timed out after 30 seconds")), 30000)
      );

      await Promise.race([loadPromise, timeoutPromise]);
      
      // Check again after loading
      if (signal.aborted) {
        throw new Error("Export cancelled");
      }
      
      setIsLoaded(true);
      console.log("FFmpeg loaded successfully");
      toast.success("Video encoder ready");
    } catch (error: any) {
      if (error?.message === "Export cancelled") {
        throw error;
      }
      console.error("Failed to load FFmpeg:", error);
      toast.error(`Failed to initialize video encoder: ${error?.message || "Unknown error"}`);
      throw error;
    }
  }, [ffmpeg, isLoaded]);

  const captureFrame = useCallback(async (
    canvas: HTMLCanvasElement,
    frameNumber: number,
    totalFrames: number,
    signal: AbortSignal
  ): Promise<void> => {
    return new Promise((resolve, reject) => {
      // Check if cancelled
      if (signal.aborted) {
        reject(new Error("Export cancelled"));
        return;
      }

      try {
        // Validate canvas has content
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error("Cannot get canvas context"));
          return;
        }

        canvas.toBlob(async (blob) => {
          try {
            if (signal.aborted) {
              reject(new Error("Export cancelled"));
              return;
            }

            if (!blob) {
              reject(new Error(`Failed to capture frame ${frameNumber}`));
              return;
            }
            
            const data = await blob.arrayBuffer();
            const filename = `frame${frameNumber.toString().padStart(5, "0")}.png`;
            
            await ffmpeg.writeFile(filename, new Uint8Array(data));
            
            if (frameNumber % 30 === 0 || frameNumber === totalFrames - 1) {
              console.log(`Captured ${frameNumber + 1}/${totalFrames} frames`);
            }
            
            resolve();
          } catch (error) {
            reject(error);
          }
        }, "image/png", 0.95);
      } catch (error) {
        reject(error);
      }
    });
  }, [ffmpeg]);

  const exportVideo = useCallback(async (
    playerRef: any,
    durationInFrames: number,
    fps: number,
    settings: ExportSettings,
    onProgress?: (progress: number) => void
  ): Promise<void> => {
    // Create new abort controller for this export
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    try {
      const { width, height } = RESOLUTION_PRESETS[settings.resolution];
      const { crf } = QUALITY_PRESETS[settings.quality];
      
      console.log("Starting export...", { 
        durationInFrames, 
        fps, 
        width, 
        height,
        resolution: settings.resolution,
        quality: settings.quality,
        crf,
        preset: settings.preset,
      });
      
      // Load FFmpeg first with detailed logging
      console.log("Step 1: Loading FFmpeg...");
      await loadFFmpeg(signal);
      console.log("Step 2: FFmpeg loaded successfully");
      
      if (signal.aborted) throw new Error("Export cancelled");
      
      setProgress(0);
      onProgress?.(0);

      // Get canvas from player
      console.log("Step 3: Getting canvas from player...");
      const container = playerRef.current?.getContainerNode();
      console.log("Player container:", container);
      
      if (!container) {
        throw new Error("Player container not found - make sure video is playing");
      }

      const canvas = container.querySelector("canvas") as HTMLCanvasElement;
      console.log("Canvas found:", canvas, "dimensions:", canvas?.width, canvas?.height);
      
      if (!canvas) {
        throw new Error("Canvas not found in player - video may not be rendered");
      }

      // Verify canvas has dimensions
      if (canvas.width === 0 || canvas.height === 0) {
        throw new Error("Canvas has no dimensions - try playing the video first");
      }

      console.log("Step 4: Preparing for frame capture...");
      
      // Pause playback
      const wasPlaying = playerRef.current?.isPlaying();
      if (wasPlaying) {
        playerRef.current?.pause();
      }

      // Wait for player to be ready
      await new Promise(resolve => setTimeout(resolve, 500));

      if (signal.aborted) throw new Error("Export cancelled");

      // Capture all frames
      toast.info(`Capturing ${durationInFrames} frames...`);
      console.log(`Step 5: Starting frame capture - ${durationInFrames} frames at ${fps} FPS`);
      
      for (let frame = 0; frame < durationInFrames; frame++) {
        if (signal.aborted) throw new Error("Export cancelled");

        try {
          // Seek to frame
          playerRef.current?.seekTo(frame);
          
          // Wait longer for frame to render (100ms + requestAnimationFrame)
          await new Promise(resolve => requestAnimationFrame(() => {
            setTimeout(resolve, 100);
          }));
          
          // Capture frame
          await captureFrame(canvas, frame, durationInFrames, signal);
          
          // Update progress (0-50% for capture)
          const captureProgress = Math.round((frame / durationInFrames) * 50);
          setProgress(captureProgress);
          onProgress?.(captureProgress);
        } catch (error: any) {
          if (error?.message === "Export cancelled") throw error;
          console.error(`Failed to capture frame ${frame}:`, error);
          throw new Error(`Frame capture failed at frame ${frame}: ${error?.message}`);
        }
      }

      console.log("All frames captured, starting encoding...");
      toast.info("Encoding video...");
      setProgress(50);
      onProgress?.(50);

      // Encode video with FFmpeg
      console.log("Running FFmpeg command with settings:", {
        resolution: `${width}x${height}`,
        crf,
        preset: settings.preset,
      });
      
      await ffmpeg.exec([
        "-framerate", fps.toString(),
        "-pattern_type", "glob",
        "-i", "frame*.png",
        "-c:v", "libx264",
        "-preset", settings.preset,
        "-crf", crf.toString(),
        "-pix_fmt", "yuv420p",
        "-s", `${width}x${height}`,
        "-y",
        "output.mp4"
      ]);

      console.log("Encoding complete, reading output file...");
      setProgress(90);
      onProgress?.(90);

      // Read the output file
      const data = await ffmpeg.readFile("output.mp4");
      
      // Convert to standard Uint8Array for blob creation
      const uint8Data = data instanceof Uint8Array ? data : new Uint8Array();
      
      if (!uint8Data || uint8Data.length === 0) {
        throw new Error("Output video file is empty");
      }
      
      console.log("Output file size:", uint8Data.length, "bytes");
      
      // Create blob - use slice to get a clean ArrayBuffer
      const blob = new Blob([uint8Data.slice()], { type: "video/mp4" });
      
      // Download the file
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `video-export-${Date.now()}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      console.log("Cleaning up temporary files...");
      // Cleanup
      const files = await ffmpeg.listDir("/");
      for (const file of files) {
        if (file.name.startsWith("frame") || file.name === "output.mp4") {
          await ffmpeg.deleteFile(file.name);
        }
      }

      setProgress(100);
      onProgress?.(100);
      toast.success("Video exported successfully!");
      console.log("Export complete!");

      // Restore playback state
      if (wasPlaying) {
        playerRef.current?.play();
      }
    } catch (error: any) {
      console.error("Export failed with error:", error);
      
      // Cleanup on error or cancellation
      try {
        const files = await ffmpeg.listDir("/");
        for (const file of files) {
          if (file.name.startsWith("frame") || file.name === "output.mp4") {
            await ffmpeg.deleteFile(file.name);
          }
        }
      } catch (cleanupError) {
        console.error("Cleanup error:", cleanupError);
      }

      setProgress(0);
      onProgress?.(0);
      
      // Only show error toast if not cancelled
      if (error?.message !== "Export cancelled") {
        toast.error(`Export failed: ${error?.message || "Unknown error"}`);
      }
      
      throw error;
    } finally {
      abortControllerRef.current = null;
    }
  }, [ffmpeg, loadFFmpeg, captureFrame]);

  return {
    exportVideo,
    cancelExport,
    progress,
    isLoaded,
  };
};
