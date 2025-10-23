import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Overlay } from "@/lib/video-editor/types";
import { toast } from "sonner";

export const useLibrarySave = (
  overlays: Overlay[],
  durationInFrames: number,
  fps: number,
  getAspectRatioDimensions: () => { width: number; height: number }
) => {
  const [progress, setProgress] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const cancelRef = useRef(false);

  const saveToLibrary = async (title?: string) => {
    if (overlays.length === 0) {
      toast.error("No content to save");
      return;
    }

    setIsLoading(true);
    setProgress(0);
    cancelRef.current = false;

    const toastId = toast.loading("Submitting render job...");

    try {
      const dimensions = getAspectRatioDimensions();
      console.log('[Save] Starting server-side render, dimensions:', dimensions);

      const compositionData = {
        overlays,
        durationInFrames,
        fps,
        width: dimensions.width,
        height: dimensions.height,
      };

      setProgress(10);
      toast.loading("Starting server render...", { id: toastId });

      // Call edge function to render video server-side
      const { data, error: invokeError } = await supabase.functions.invoke(
        'render-editor-composition',
        {
          body: {
            compositionData,
            title: title || `Editor Video ${new Date().toLocaleDateString()}`,
          },
        }
      );

      if (invokeError) {
        console.error('[Save] Invoke error:', invokeError);
        throw new Error(invokeError.message || 'Failed to start render');
      }

      if (cancelRef.current) {
        setIsLoading(false);
        setProgress(0);
        return;
      }

      console.log('[Save] Render job submitted:', data);
      
      if (!data.success) {
        throw new Error(data.error || 'Render failed');
      }

      setProgress(100);
      toast.success("Video saved to library!", { id: toastId });
      setIsLoading(false);

      setTimeout(() => {
        navigate('/content-studio/library');
      }, 1000);

    } catch (error) {
      console.error("Error saving to library:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to save video",
        { id: toastId }
      );
      setIsLoading(false);
      setProgress(0);
    }
  };

  return { saveToLibrary, progress, isLoading };
};
