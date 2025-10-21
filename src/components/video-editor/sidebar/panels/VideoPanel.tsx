import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus } from "lucide-react";
import { useEditorContext } from "@/contexts/video-editor/EditorContext";
import { OverlayType } from "@/lib/video-editor/types";

export const VideoPanel: React.FC = () => {
  const { addOverlay, currentFrame } = useEditorContext();
  const [url, setUrl] = useState("");

  const handleAddVideo = () => {
    if (!url) return;

    addOverlay({
      id: Date.now(),
      type: OverlayType.VIDEO,
      src: url,
      content: "",
      from: currentFrame,
      durationInFrames: 150,
      left: 0,
      top: 0,
      width: 1920,
      height: 1080,
      row: 0,
      rotation: 0,
      isDragging: false,
      videoStartTime: 0,
      styles: {
        objectFit: "cover",
        opacity: 1,
      },
    });
    setUrl("");
  };

  return (
    <div className="p-4 space-y-4">
      <div>
        <Input
          placeholder="Enter video URL"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
      </div>
      <Button onClick={handleAddVideo} className="w-full" disabled={!url}>
        <Plus className="h-4 w-4 mr-2" />
        Add Video
      </Button>
      <p className="text-xs text-muted-foreground">
        Paste a video URL to add it to the timeline
      </p>
    </div>
  );
};
