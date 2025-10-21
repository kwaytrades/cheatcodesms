import React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Overlay } from "@/lib/video-editor/types";
import { GripVertical } from "lucide-react";

interface TimelineItemProps {
  overlay: Overlay;
  durationInFrames: number;
  isSelected: boolean;
  onSelect: () => void;
  rowHeight: number;
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
}) => {
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

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded px-2 py-1 text-xs cursor-move flex items-center gap-1 transition-all ${getOverlayColor(
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
      {...attributes}
      {...listeners}
    >
      <GripVertical className="h-3 w-3 text-white/50 flex-none" />
      <span className="text-white font-medium truncate block flex-1">
        {overlay.type === "text" ? overlay.content : overlay.type}
      </span>
    </div>
  );
};
