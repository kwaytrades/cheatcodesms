import { useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Overlay } from "@/lib/video-editor/types";
import { toast } from "sonner";
import { renderVideoToMP4 } from "@/lib/video-editor/client-render";
import { PlayerRef } from "@remotion/player";

export const useLibrarySave = (
  overlays: Overlay[],
  durationInFrames: number,
  fps: number,
  getAspectRatioDimensions: () => { width: number; height: number },
  playerRef: React.RefObject<PlayerRef>,
  containerRef: React.RefObject<HTMLDivElement>
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

    const toastId = toast.loading("Rendering video...");

    try {
      const dimensions = getAspectRatioDimensions();
      console.log('[Save] Starting client-side render, dimensions:', dimensions);

      // Render video using Remotion Player + FFmpeg
      const videoBlob = await renderVideoToMP4({
        playerRef,
        containerRef,
        overlays,
        durationInFrames,
        fps,
        width: dimensions.width,
        height: dimensions.height,
        onProgress: (percent) => {
          setProgress(percent * 0.9); // Reserve last 10% for upload
          toast.loading(`Rendering: ${Math.round(percent)}%`, { id: toastId });
        },
      });

      if (cancelRef.current) {
        setIsLoading(false);
        setProgress(0);
        return;
      }

      console.log('[Save] Video rendered, size:', videoBlob.size, 'bytes');
      
      // Upload to storage
      toast.loading("Uploading...", { id: toastId });
      setProgress(92);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const fileName = `editor-${Date.now()}.mp4`;
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('content-videos')
        .upload(filePath, videoBlob, {
          contentType: 'video/mp4',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      setProgress(96);

      // Create database entry
      const durationSeconds = Math.round(durationInFrames / fps);

      const { error: dbError } = await supabase
        .from('content_videos')
        .insert({
          user_id: user.id,
          video_url: filePath,
          duration_seconds: durationSeconds,
          title: title || `Editor Video ${new Date().toLocaleDateString()}`,
          source: 'editor',
          composition_data: { overlays, durationInFrames, fps, width: dimensions.width, height: dimensions.height },
          is_final: true,
        });

      if (dbError) throw dbError;

      setProgress(100);
      toast.success("Video saved to library!", { id: toastId });
      setIsLoading(false);

      setTimeout(() => navigate('/content-studio/library'), 1000);

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
