import { DragEndEvent } from "@dnd-kit/core";
import { Overlay } from "@/lib/video-editor/types";

interface UseTimelineDragProps {
  overlays: Overlay[];
  changeOverlay: (id: number, updater: Partial<Overlay> | ((overlay: Overlay) => Overlay)) => void;
  durationInFrames: number;
  timelineWidth: number;
}

export const useTimelineDrag = ({
  overlays,
  changeOverlay,
  durationInFrames,
  timelineWidth,
}: UseTimelineDragProps) => {
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, delta } = event;
    
    if (!active.data.current) return;
    
    const overlay = active.data.current.overlay as Overlay;
    if (!overlay) return;

    // Calculate frame delta from pixel delta
    const pixelsPerFrame = timelineWidth / durationInFrames;
    const frameDelta = Math.round(delta.x / pixelsPerFrame);
    
    // Calculate new position
    const newFrom = Math.max(0, Math.min(
      durationInFrames - overlay.durationInFrames,
      overlay.from + frameDelta
    ));

    // Calculate row change if vertical drag
    const rowDelta = Math.round(delta.y / 60); // 60px per row
    const newRow = Math.max(0, Math.min(9, (overlay.row || 0) + rowDelta)); // Max 10 rows

    // Update overlay position
    changeOverlay(overlay.id, {
      from: newFrom,
      row: newRow,
    });
  };

  return {
    handleDragEnd,
  };
};
