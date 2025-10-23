import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Overlay } from "@/lib/video-editor/types";
import { toast } from "sonner";
import { CanvasRenderer } from "@/lib/video-editor/canvas-renderer";

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

    const toastId = toast.loading("Rendering video...");

    try {
      const dimensions = getAspectRatioDimensions();
      console.log('Rendering video for library with dimensions:', dimensions);
      
      setProgress(5);

      // Create canvas renderer
      const renderer = new CanvasRenderer(dimensions.width, dimensions.height);
      
      toast.loading("Loading assets...", { id: toastId });
      setProgress(10);
      
      // Preload all assets
      await renderer.preloadAssets(overlays);
      
      if (cancelRef.current) {
        renderer.destroy();
        return;
      }

      toast.loading("Recording video...", { id: toastId });
      setProgress(15);

      // Get canvas and create stream
      const canvas = renderer.getCanvas();
      const stream = canvas.captureStream(fps);

      // Add audio tracks if any
      const audioElements = renderer.getAudioElements();
      if (audioElements.size > 0) {
        const audioContext = new AudioContext({ sampleRate: 48000 });
        const destination = audioContext.createMediaStreamDestination();
        
        for (const audio of audioElements.values()) {
          const source = audioContext.createMediaElementSource(audio);
          source.connect(destination);
        }
        
        destination.stream.getAudioTracks().forEach(track => {
          stream.addTrack(track);
        });
      }

      // Setup MediaRecorder
      const chunks: Blob[] = [];
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp9',
        videoBitsPerSecond: 8000000,
      });

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        console.log('[Save] Recording stopped');
        
        if (cancelRef.current) {
          renderer.destroy();
          return;
        }

        try {
          const webmBlob = new Blob(chunks, { type: 'video/webm' });
          console.log('[Save] Video blob created, size:', webmBlob.size, 'bytes');

          if (webmBlob.size === 0) {
            throw new Error('Recording produced an empty file');
          }
          
          setProgress(50);
          toast.loading("Uploading to library...", { id: toastId });

          // Get user session
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) {
            throw new Error('Not authenticated');
          }

          // Upload to storage
          const fileName = `editor-${Date.now()}.webm`;
          const filePath = `${user.id}/${fileName}`;
          
          const { error: uploadError } = await supabase.storage
            .from('content-videos')
            .upload(filePath, webmBlob, {
              contentType: 'video/webm',
              upsert: false,
            });

          if (uploadError) {
            console.error('Upload error:', uploadError);
            throw uploadError;
          }

          setProgress(75);

          // Get public URL
          const { data: { publicUrl } } = supabase.storage
            .from('content-videos')
            .getPublicUrl(filePath);

          // Create database entry
          const durationSeconds = Math.round(durationInFrames / fps);
          
          const { error: dbError } = await supabase
            .from('content_videos')
            .insert({
              user_id: user.id,
              video_url: filePath, // Store path, not full URL
              duration_seconds: durationSeconds,
              title: title || `Editor Video ${new Date().toLocaleDateString()}`,
              source: 'editor',
              composition_data: {
                overlays,
                durationInFrames,
                fps,
                width: dimensions.width,
                height: dimensions.height,
              },
              is_final: true,
            });

          if (dbError) {
            console.error('Database error:', dbError);
            throw dbError;
          }

          renderer.destroy();
          setProgress(100);
          toast.success("Video saved to library!", { id: toastId });
          
          setTimeout(() => {
            navigate('/content-studio/library');
          }, 1000);

        } catch (error) {
          console.error('[Save] Error:', error);
          toast.error(
            error instanceof Error ? error.message : "Failed to save video",
            { id: toastId }
          );
          renderer.destroy();
          setIsLoading(false);
          setProgress(0);
        }
      };

      mediaRecorder.onerror = (e) => {
        console.error('MediaRecorder error:', e);
        toast.error("Recording failed", { id: toastId });
        renderer.destroy();
        setIsLoading(false);
      };

      // Start recording
      mediaRecorder.start();

      // Render all frames
      const totalFrames = durationInFrames;
      const frameInterval = 1000 / fps;
      
      for (let frame = 0; frame < totalFrames; frame++) {
        if (cancelRef.current) {
          mediaRecorder.stop();
          renderer.destroy();
          return;
        }

        await renderer.renderFrame(overlays, frame, fps);
        
        const frameProgress = 15 + ((frame / totalFrames) * 30);
        setProgress(Math.round(frameProgress));
        
        await new Promise(resolve => setTimeout(resolve, frameInterval));
      }

      setProgress(45);
      mediaRecorder.stop();
      stream.getTracks().forEach(track => track.stop());

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
