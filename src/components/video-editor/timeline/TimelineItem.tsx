import React, { useState, useRef, useEffect } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Overlay, OverlayType } from "@/lib/video-editor/types";
import { GripVertical, Scissors } from "lucide-react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  ContextMenuSeparator,
} from "@/components/ui/context-menu";
import { useEditorContext } from "@/contexts/video-editor/EditorContext";

interface TimelineItemProps {
  overlay: Overlay;
  durationInFrames: number;
  isSelected: boolean;
  onSelect: () => void;
  rowHeight: number;
  timelineWidth: number;
}

const getOverlayColor = (overlay: Overlay) => {
  switch (overlay.type) {
    case "text":
      return "bg-purple-500";
    case "video":
      return "bg-blue-500";
    case "image":
      return "bg-pink-500";
    case "sound":
      return "bg-green-500";
    default:
      return "bg-gray-500";
  }
};

export const TimelineItem: React.FC<TimelineItemProps> = ({
  overlay,
  durationInFrames,
  isSelected,
  onSelect,
  rowHeight,
  timelineWidth,
}) => {
  const { changeOverlay, splitOverlay, duplicateOverlay, deleteOverlay, currentFrame } = useEditorContext();
  const [isResizing, setIsResizing] = useState<'left' | 'right' | null>(null);
  const resizeStartRef = useRef<{ x: number; from: number; duration: number } | null>(null);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: overlay.id,
    data: {
      type: "timeline-item",
      overlay,
    },
    disabled: isResizing !== null,
  });

  const style: React.CSSProperties = {
    position: "absolute",
    left: `${(overlay.from / durationInFrames) * 100}%`,
    width: `${(overlay.durationInFrames / durationInFrames) * 100}%`,
    top: `${rowHeight / 4}px`,
    height: `${rowHeight / 2}px`,
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1000 : isSelected ? 100 : 1,
  };

  const handleResizeStart = (edge: 'left' | 'right') => (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsResizing(edge);
    resizeStartRef.current = {
      x: e.clientX,
      from: overlay.from,
      duration: overlay.durationInFrames,
    };
  };

  useEffect(() => {
    if (!isResizing || !resizeStartRef.current) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!resizeStartRef.current) return;

      const deltaX = e.clientX - resizeStartRef.current.x;
      const pixelsPerFrame = timelineWidth / durationInFrames;
      const frameDelta = Math.round(deltaX / pixelsPerFrame);

      if (isResizing === 'left') {
        // Trim start
        const newFrom = Math.max(0, resizeStartRef.current.from + frameDelta);
        const newDuration = resizeStartRef.current.duration - frameDelta;
        if (newDuration > 10) { // Min 10 frames
          const updates: any = {
            from: newFrom,
            durationInFrames: newDuration,
          };
          
          // Update video/audio start time when trimming from left
          if (overlay.type === OverlayType.VIDEO) {
            const currentVideoStart = (overlay as any).videoStartTime || 0;
            updates.videoStartTime = currentVideoStart + (frameDelta / 30);
          }
          
          if (overlay.type === OverlayType.SOUND) {
            const currentAudioStart = (overlay as any).startFromSound || 0;
            updates.startFromSound = currentAudioStart + (frameDelta / 30);
          }
          
          changeOverlay(overlay.id, updates);
        }
      } else {
        // Trim end
        const newDuration = Math.max(10, resizeStartRef.current.duration + frameDelta);
        changeOverlay(overlay.id, {
          durationInFrames: newDuration,
        });
      }
    };

    const handleMouseUp = () => {
      setIsResizing(null);
      resizeStartRef.current = null;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, overlay.id, changeOverlay, durationInFrames, timelineWidth]);

  const canSplit = currentFrame >= overlay.from && currentFrame < overlay.from + overlay.durationInFrames;

  const handleSplit = () => {
    if (canSplit) {
      splitOverlay(overlay.id, currentFrame);
    }
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger>
        <div
          ref={setNodeRef}
          style={style}
          className={`rounded px-2 py-1 text-xs flex items-center gap-1 transition-all relative ${getOverlayColor(
            overlay
          )} ${
            isSelected
              ? "ring-2 ring-primary shadow-lg"
              : "opacity-80 hover:opacity-100"
          }`}
          onClick={(e) => {
            e.stopPropagation();
            onSelect();
          }}
        >
          {/* Left resize handle */}
          <div
            className="absolute left-0 top-0 bottom-0 w-1 cursor-ew-resize hover:bg-white/50 transition-colors z-10"
            onMouseDown={handleResizeStart('left')}
            onClick={(e) => e.stopPropagation()}
          />

          {/* Main content with drag handle */}
          <div className="flex items-center gap-1 flex-1 min-w-0 cursor-move" {...attributes} {...listeners}>
            <GripVertical className="h-3 w-3 text-white/50 flex-none" />
            <span className="text-white font-medium truncate block flex-1">
              {overlay.type === "text" ? overlay.content : overlay.type}
            </span>
          </div>

          {/* Right resize handle */}
          <div
            className="absolute right-0 top-0 bottom-0 w-1 cursor-ew-resize hover:bg-white/50 transition-colors z-10"
            onMouseDown={handleResizeStart('right')}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      </ContextMenuTrigger>
      
      <ContextMenuContent>
        <ContextMenuItem onClick={handleSplit} disabled={!canSplit}>
          <Scissors className="h-4 w-4 mr-2" />
          Split at Playhead
        </ContextMenuItem>
        <ContextMenuItem onClick={() => duplicateOverlay(overlay.id)}>
          Duplicate
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={() => deleteOverlay(overlay.id)} className="text-destructive">
          Delete
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
};
