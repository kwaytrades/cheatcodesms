import { useState } from "react";
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

  const saveToLibrary = async (title?: string) => {
    if (overlays.length === 0) {
      toast.error("No content to save");
      return;
    }

    setIsLoading(true);
    setProgress(0);

    const toastId = toast.loading("Preparing to save...");

    try {
      const dimensions = getAspectRatioDimensions();
      
      // Prepare composition data
      const compositionData = {
        overlays,
        durationInFrames,
        fps,
        width: dimensions.width,
        height: dimensions.height,
      };

      console.log('Saving to library with composition:', compositionData);
      
      setProgress(10);
      toast.loading("Starting server-side render...", { id: toastId });

      // Get auth session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      // Call edge function to render video
      const { data, error } = await supabase.functions.invoke('render-editor-composition', {
        body: {
          compositionData,
          title: title || `Editor Video ${new Date().toLocaleDateString()}`,
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        console.error('Edge function error:', error);
        throw error;
      }

      console.log('Save response:', data);

      if (!data.success) {
        throw new Error(data.error || 'Failed to save video');
      }

      setProgress(100);
      toast.success("Video saved to library!", { id: toastId });
      
      // Navigate to library after a brief delay
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
