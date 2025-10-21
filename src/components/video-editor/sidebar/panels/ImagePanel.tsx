import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus } from "lucide-react";
import { useEditorContext } from "@/contexts/video-editor/EditorContext";
import { OverlayType } from "@/lib/video-editor/types";

export const ImagePanel: React.FC = () => {
  const { addOverlay, currentFrame } = useEditorContext();
  const [url, setUrl] = useState("");

  const handleAddImage = () => {
    if (!url) return;

    addOverlay({
      id: Date.now(),
      type: OverlayType.IMAGE,
      src: url,
      from: currentFrame,
      durationInFrames: 90,
      left: 100,
      top: 100,
      width: 400,
      height: 300,
      row: 1,
      rotation: 0,
      isDragging: false,
      styles: {
        objectFit: "contain",
        opacity: 1,
      },
    });
    setUrl("");
  };

  return (
    <div className="p-4 space-y-4">
      <div>
        <Input
          placeholder="Enter image URL"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
      </div>
      <Button onClick={handleAddImage} className="w-full" disabled={!url}>
        <Plus className="h-4 w-4 mr-2" />
        Add Image
      </Button>
      <p className="text-xs text-muted-foreground">
        Paste an image URL to add it to the timeline
      </p>
    </div>
  );
};
