import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";
import { useEditorContext } from "@/contexts/video-editor/EditorContext";
import { OverlayType, SoundOverlay } from "@/lib/video-editor/types";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const SoundPanel: React.FC = () => {
  const { addOverlay, currentFrame } = useEditorContext();
  const [isUploading, setIsUploading] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate audio file
    if (!file.type.startsWith('audio/')) {
      toast.error("Please select an audio file");
      return;
    }

    setIsUploading(true);
    try {
      // Upload to Supabase storage
      const filePath = `audio/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('content-videos')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('content-videos')
        .getPublicUrl(filePath);

      // Get audio duration
      const audio = new Audio();
      audio.src = URL.createObjectURL(file);
      
      audio.onloadedmetadata = () => {
        const durationInSeconds = audio.duration;
        const durationInFrames = Math.round(durationInSeconds * 30); // 30 FPS

        // Add audio overlay
        const audioOverlay: SoundOverlay = {
          id: Date.now(),
          type: OverlayType.SOUND,
          content: file.name,
          src: publicUrl,
          startFromSound: 0,
          from: currentFrame,
          durationInFrames,
          left: 0,
          top: 0,
          width: 0,
          height: 0,
          row: 0,
          rotation: 0,
          isDragging: false,
          styles: {
            volume: 1,
          },
        };

        addOverlay(audioOverlay);
        toast.success("Audio added successfully");
        URL.revokeObjectURL(audio.src);
      };

      audio.onerror = () => {
        toast.error("Failed to load audio metadata");
        URL.revokeObjectURL(audio.src);
        setIsUploading(false);
      };
    } catch (error) {
      console.error("Error uploading audio:", error);
      toast.error("Failed to upload audio");
      setIsUploading(false);
    }
  };

  return (
    <div className="p-4 space-y-4">
      <div>
        <h3 className="font-semibold mb-2">Upload Audio</h3>
        <label htmlFor="audio-upload">
          <Button
            variant="outline"
            className="w-full"
            disabled={isUploading}
            asChild
          >
            <div className="cursor-pointer">
              <Upload className="h-4 w-4 mr-2" />
              {isUploading ? "Uploading..." : "Upload Audio File"}
            </div>
          </Button>
          <input
            id="audio-upload"
            type="file"
            accept="audio/*"
            onChange={handleFileUpload}
            className="hidden"
          />
        </label>
        <p className="text-xs text-muted-foreground mt-2">
          Supported formats: MP3, WAV, OGG, M4A
        </p>
      </div>
    </div>
  );
};
