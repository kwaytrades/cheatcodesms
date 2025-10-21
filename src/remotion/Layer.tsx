import React, { useMemo } from "react";
import { Sequence } from "remotion";
import { LayerContent } from "./LayerContent";
import { Overlay } from "@/lib/video-editor/types";

export const Layer: React.FC<{
  overlay: Overlay;
  selectedOverlayId: number | null;
}> = ({ overlay, selectedOverlayId }) => {
  const style: React.CSSProperties = useMemo(() => {
    // Higher row numbers appear on top (row 9 has highest z-index)
    const baseZIndex = (overlay.row || 0) * 10;
    const isSelected = overlay.id === selectedOverlayId;
    // Add extra z-index if selected to bring it to front
    const zIndex = isSelected ? baseZIndex + 1000 : baseZIndex;

    return {
      position: "absolute",
      left: overlay.left,
      top: overlay.top,
      width: overlay.width,
      height: overlay.height,
      transform: `rotate(${overlay.rotation || 0}deg)`,
      transformOrigin: "center center",
      zIndex,
      pointerEvents: "all", // Always allow pointer events for selection
      cursor: isSelected ? "move" : "pointer",
    };
  }, [
    overlay.height,
    overlay.left,
    overlay.top,
    overlay.width,
    overlay.rotation,
    overlay.row,
    overlay.id,
    selectedOverlayId,
  ]);

  if (overlay.type === "sound") {
    return (
      <Sequence
        key={overlay.id}
        from={overlay.from}
        durationInFrames={overlay.durationInFrames}
      >
        <LayerContent overlay={overlay} />
      </Sequence>
    );
  }

  return (
    <Sequence
      key={overlay.id}
      from={overlay.from}
      durationInFrames={overlay.durationInFrames}
      layout="none"
    >
      <div 
        style={style}
        onClick={(e) => {
          e.stopPropagation();
          // This will trigger selection in the parent Main component
        }}
      >
        <LayerContent overlay={overlay} />
      </div>
    </Sequence>
  );
};
