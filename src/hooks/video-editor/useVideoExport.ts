import { useState, useCallback } from "react";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";
import { toast } from "sonner";

export const useVideoExport = () => {
  const [ffmpeg] = useState(() => new FFmpeg());
  const [isLoaded, setIsLoaded] = useState(false);
  const [progress, setProgress] = useState(0);

  const loadFFmpeg = useCallback(async () => {
    if (isLoaded) return;

    try {
      toast.info("Initializing video encoder...");
      const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd";
      
      console.log("Loading FFmpeg from:", baseURL);
      
      await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
      });
      
      ffmpeg.on("progress", ({ progress: p }) => {
        const progressPercent = Math.round(p * 100);
        console.log("FFmpeg encoding progress:", progressPercent);
        setProgress(50 + Math.round(p * 40)); // 50-90% for encoding
      });
      
      ffmpeg.on("log", ({ message }) => {
        console.log("FFmpeg log:", message);
      });
      
      setIsLoaded(true);
      console.log("FFmpeg loaded successfully");
      toast.success("Video encoder ready");
    } catch (error) {
      console.error("Failed to load FFmpeg:", error);
      toast.error(`Failed to initialize video encoder: ${error.message}`);
      throw error;
    }
  }, [ffmpeg, isLoaded]);

  const captureFrame = useCallback(async (
    canvas: HTMLCanvasElement,
    frameNumber: number,
    totalFrames: number
  ): Promise<void> => {
    return new Promise((resolve, reject) => {
      try {
        // Validate canvas has content
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error("Cannot get canvas context"));
          return;
        }

        canvas.toBlob(async (blob) => {
          try {
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
    width: number,
    height: number,
    onProgress?: (progress: number) => void
  ): Promise<void> => {
    try {
      console.log("Starting export...", { durationInFrames, fps, width, height });
      
      // Load FFmpeg first
      await loadFFmpeg();
      setProgress(0);
      onProgress?.(0);

      // Get canvas from player
      const container = playerRef.current?.getContainerNode();
      console.log("Player container:", container);
      
      if (!container) {
        throw new Error("Player container not found");
      }

      const canvas = container.querySelector("canvas") as HTMLCanvasElement;
      console.log("Canvas found:", canvas, "dimensions:", canvas?.width, canvas?.height);
      
      if (!canvas) {
        throw new Error("Canvas not found in player");
      }

      // Verify canvas has dimensions
      if (canvas.width === 0 || canvas.height === 0) {
        throw new Error("Canvas has no dimensions");
      }

      // Pause playback
      const wasPlaying = playerRef.current?.isPlaying();
      if (wasPlaying) {
        playerRef.current?.pause();
      }

      // Wait for player to be ready
      await new Promise(resolve => setTimeout(resolve, 500));

      // Capture all frames
      toast.info(`Capturing ${durationInFrames} frames...`);
      console.log(`Starting frame capture: ${durationInFrames} frames at ${fps} FPS`);
      
      for (let frame = 0; frame < durationInFrames; frame++) {
        try {
          // Seek to frame
          playerRef.current?.seekTo(frame);
          
          // Wait longer for frame to render (100ms + requestAnimationFrame)
          await new Promise(resolve => requestAnimationFrame(() => {
            setTimeout(resolve, 100);
          }));
          
          // Capture frame
          await captureFrame(canvas, frame, durationInFrames);
          
          // Update progress (0-50% for capture)
          const captureProgress = Math.round((frame / durationInFrames) * 50);
          setProgress(captureProgress);
          onProgress?.(captureProgress);
        } catch (error) {
          console.error(`Failed to capture frame ${frame}:`, error);
          throw new Error(`Frame capture failed at frame ${frame}: ${error.message}`);
        }
      }

      console.log("All frames captured, starting encoding...");
      toast.info("Encoding video...");
      setProgress(50);
      onProgress?.(50);

      // Encode video with FFmpeg
      console.log("Running FFmpeg command...");
      await ffmpeg.exec([
        "-framerate", fps.toString(),
        "-pattern_type", "glob",
        "-i", "frame*.png",
        "-c:v", "libx264",
        "-preset", "medium", // Changed from "slow" for faster encoding
        "-crf", "18", // High quality
        "-pix_fmt", "yuv420p",
        "-s", `${width}x${height}`,
        "-y", // Overwrite output file
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
    } catch (error) {
      console.error("Export failed with error:", error);
      setProgress(0);
      onProgress?.(0);
      
      // Show detailed error to user
      toast.error(`Export failed: ${error.message || "Unknown error"}`);
      throw error;
    }
  }, [ffmpeg, loadFFmpeg, captureFrame]);

  return {
    exportVideo,
    progress,
    isLoaded,
  };
};
