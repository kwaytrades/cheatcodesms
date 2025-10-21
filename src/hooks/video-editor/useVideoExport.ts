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
      const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd";
      await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
      });
      
      ffmpeg.on("progress", ({ progress: p }) => {
        setProgress(Math.round(p * 100));
      });
      
      setIsLoaded(true);
    } catch (error) {
      console.error("Failed to load FFmpeg:", error);
      toast.error("Failed to initialize video encoder");
      throw error;
    }
  }, [ffmpeg, isLoaded]);

  const captureFrame = useCallback(async (
    canvas: HTMLCanvasElement,
    frameNumber: number
  ): Promise<void> => {
    return new Promise((resolve) => {
      canvas.toBlob(async (blob) => {
        if (blob) {
          const data = await blob.arrayBuffer();
          await ffmpeg.writeFile(
            `frame${frameNumber.toString().padStart(5, "0")}.png`,
            new Uint8Array(data)
          );
        }
        resolve();
      }, "image/png");
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
      await loadFFmpeg();
      setProgress(0);

      // Get canvas from player
      const canvas = playerRef.current?.getContainerNode()?.querySelector("canvas");
      if (!canvas) {
        throw new Error("Canvas not found");
      }

      const wasPlaying = !playerRef.current?.isPlaying();
      if (wasPlaying) {
        playerRef.current?.pause();
      }

      // Capture all frames
      toast.info(`Capturing ${durationInFrames} frames...`);
      
      for (let frame = 0; frame < durationInFrames; frame++) {
        playerRef.current?.seekTo(frame);
        
        // Wait for frame to render
        await new Promise(resolve => setTimeout(resolve, 50));
        
        await captureFrame(canvas, frame);
        
        const captureProgress = Math.round((frame / durationInFrames) * 50);
        setProgress(captureProgress);
        onProgress?.(captureProgress);
      }

      toast.info("Encoding video...");
      setProgress(50);

      // Encode video with FFmpeg
      await ffmpeg.exec([
        "-framerate", fps.toString(),
        "-pattern_type", "glob",
        "-i", "frame*.png",
        "-c:v", "libx264",
        "-preset", "slow",
        "-crf", "18", // High quality (0-51, lower is better)
        "-pix_fmt", "yuv420p",
        "-s", `${width}x${height}`,
        "output.mp4"
      ]);

      setProgress(90);

      // Read the output file
      const data = await ffmpeg.readFile("output.mp4");
      const uint8Data = data instanceof Uint8Array ? data : new Uint8Array();
      // Create blob with proper type
      const arrayBuffer = new ArrayBuffer(uint8Data.length);
      const view = new Uint8Array(arrayBuffer);
      view.set(uint8Data);
      const blob = new Blob([arrayBuffer], { type: "video/mp4" });
      
      // Download the file
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `video-export-${Date.now()}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // Cleanup
      const files = await ffmpeg.listDir("/");
      for (const file of files) {
        if (file.name.startsWith("frame") || file.name === "output.mp4") {
          await ffmpeg.deleteFile(file.name);
        }
      }

      setProgress(100);
      toast.success("Video exported successfully!");

      // Restore playback state
      if (wasPlaying) {
        playerRef.current?.play();
      }
    } catch (error) {
      console.error("Export failed:", error);
      setProgress(0);
      throw error;
    }
  }, [ffmpeg, loadFFmpeg, captureFrame]);

  return {
    exportVideo,
    progress,
    isLoaded,
  };
};
