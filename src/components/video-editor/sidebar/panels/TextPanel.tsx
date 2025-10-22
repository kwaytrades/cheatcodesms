import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus } from "lucide-react";
import { useEditorContext } from "@/contexts/video-editor/EditorContext";
import { OverlayType } from "@/lib/video-editor/types";

export const TextPanel: React.FC = () => {
  const { addOverlay, selectedOverlayId, overlays, changeOverlay, currentFrame } = useEditorContext();
  const selectedOverlay = overlays.find(o => o.id === selectedOverlayId);
  const isTextSelected = selectedOverlay?.type === OverlayType.TEXT;

  const handleAddText = () => {
    addOverlay({
      id: Date.now(),
      type: OverlayType.TEXT,
      content: "New Text",
      from: currentFrame,
      durationInFrames: 90,
      left: 100,
      top: 100,
      width: 300,
      height: 100,
      row: 0,
      rotation: 0,
      isDragging: false,
      styles: {
        fontSize: "32px",
        fontWeight: "bold",
        color: "#ffffff",
        backgroundColor: "transparent",
        fontFamily: "Arial",
        fontStyle: "normal",
        textDecoration: "none",
        textAlign: "center",
        opacity: 1,
      },
    });
  };

  if (!isTextSelected) {
    return (
      <div className="p-4 space-y-4">
        <Button onClick={handleAddText} className="w-full">
          <Plus className="h-4 w-4 mr-2" />
          Add Text
        </Button>
        <p className="text-sm text-muted-foreground text-center">
          Click to add text or select existing text to edit
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div>
        <Label>Text Content</Label>
        <Input
          value={selectedOverlay.content}
          onChange={(e) =>
            changeOverlay(selectedOverlay.id, {
              ...selectedOverlay,
              content: e.target.value,
            })
          }
        />
      </div>

      <div>
        <Label>Font Size</Label>
        <Input
          type="number"
          value={parseInt(selectedOverlay.styles.fontSize)}
          onChange={(e) =>
            changeOverlay(selectedOverlay.id, {
              ...selectedOverlay,
              styles: {
                ...selectedOverlay.styles,
                fontSize: `${e.target.value}px`,
              },
            })
          }
        />
      </div>

      <div>
        <Label>Color</Label>
        <Input
          type="color"
          value={selectedOverlay.styles.color}
          onChange={(e) =>
            changeOverlay(selectedOverlay.id, {
              ...selectedOverlay,
              styles: {
                ...selectedOverlay.styles,
                color: e.target.value,
              },
            })
          }
        />
      </div>

      <div>
        <Label>Font Weight</Label>
        <select
          className="w-full p-2 border rounded"
          value={selectedOverlay.styles.fontWeight}
          onChange={(e) =>
            changeOverlay(selectedOverlay.id, {
              ...selectedOverlay,
              styles: {
                ...selectedOverlay.styles,
                fontWeight: e.target.value,
              },
            })
          }
        >
          <option value="normal">Normal</option>
          <option value="bold">Bold</option>
          <option value="600">Semi Bold</option>
          <option value="300">Light</option>
        </select>
      </div>

      <div>
        <Label>Font Family</Label>
        <select
          className="w-full p-2 border rounded"
          value={selectedOverlay.styles.fontFamily}
          onChange={(e) =>
            changeOverlay(selectedOverlay.id, {
              ...selectedOverlay,
              styles: {
                ...selectedOverlay.styles,
                fontFamily: e.target.value,
              },
            })
          }
        >
          <optgroup label="Web Safe Fonts">
            <option value="Arial">Arial</option>
            <option value="Helvetica">Helvetica</option>
            <option value="Times New Roman">Times New Roman</option>
            <option value="Georgia">Georgia</option>
            <option value="Courier New">Courier New</option>
            <option value="Verdana">Verdana</option>
          </optgroup>
          <optgroup label="Google Fonts">
            <option value="Roboto">Roboto</option>
            <option value="Open Sans">Open Sans</option>
            <option value="Lato">Lato</option>
            <option value="Montserrat">Montserrat</option>
            <option value="Playfair Display">Playfair Display</option>
            <option value="Oswald">Oswald</option>
          </optgroup>
        </select>
      </div>
    </div>
  );
};
