import { useState, useCallback, useRef } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ExportSettings } from "@/lib/video-editor/types";

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

  const exportVideo = useCallback(async (
    playerRef: any,
    durationInFrames: number,
    fps: number,
    settings: ExportSettings,
    onProgress?: (progress: number) => void
  ): Promise<void> => {
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    try {
      console.log("Starting server-side export...", {
        durationInFrames,
        fps,
        resolution: settings.resolution,
        quality: settings.quality,
      });

      setProgress(0);
      onProgress?.(0);
      toast.info("Starting export on server...");

      // Get the composition data from the player
      const container = playerRef.current?.getContainerNode();
      if (!container) {
        throw new Error("Player container not found");
      }

      // Get overlays and composition settings from the player's input props
      const playerProps = (playerRef.current as any)?.props?.inputProps;
      if (!playerProps) {
        throw new Error("Cannot access player composition data");
      }

      // Call the edge function to render the video
      const { data, error } = await supabase.functions.invoke('render-video', {
        body: {
          composition: {
            id: 'Main',
            durationInFrames,
            fps,
            width: playerProps.width,
            height: playerProps.height,
            inputProps: playerProps,
          },
          settings,
        },
      });

      if (error) throw error;
      if (!data) throw new Error("No response from render function");

      const { renderId } = data;
      console.log("Render started with ID:", renderId);

      // Poll for progress
      let isComplete = false;
      while (!isComplete && !signal.aborted) {
        await new Promise(resolve => setTimeout(resolve, 2000));

        const { data: progressData, error: progressError } = await supabase.functions.invoke(
          'render-video-progress',
          {
            body: { renderId },
          }
        );

        if (progressError) {
          console.error("Progress check error:", progressError);
          continue;
        }

        if (progressData) {
          const { progress: currentProgress, status, url, error: renderError } = progressData;

          if (status === 'error') {
            throw new Error(renderError || 'Render failed');
          }

          if (status === 'done' && url) {
            isComplete = true;
            setProgress(100);
            onProgress?.(100);
            
            // Download the video
            const a = document.createElement('a');
            a.href = url;
            a.download = `video-export-${settings.resolution}-${Date.now()}.mp4`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            
            toast.success("Video exported successfully!");
          } else {
            const progressPercent = Math.min(Math.round(currentProgress || 0), 99);
            setProgress(progressPercent);
            onProgress?.(progressPercent);
          }
        }
      }

      if (signal.aborted) throw new Error("Export cancelled");

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
