import React from "react";
import { useTimeline } from "@/contexts/video-editor/TimelineContext";
import { useEditorContext } from "@/contexts/video-editor/EditorContext";
import { Overlay } from "@/lib/video-editor/types";
import { Card } from "@/components/ui/card";
import { ROW_HEIGHT } from "@/lib/video-editor/constants";

interface TimelineProps {
  onTimelineClick: (e: React.MouseEvent<HTMLDivElement>) => void;
}

export const AdvancedTimeline: React.FC<TimelineProps> = ({ onTimelineClick }) => {
  const { timelineRef, zoomScale, visibleRows } = useTimeline();
  const { overlays, currentFrame, durationInFrames, selectedOverlayId, setSelectedOverlayId } =
    useEditorContext();

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

  return (
    <Card className="p-4">
      <div
        ref={timelineRef}
        className="relative bg-muted/30 rounded"
        style={{
          width: `${100 * zoomScale}%`,
          minHeight: `${visibleRows * ROW_HEIGHT}px`,
        }}
        onClick={onTimelineClick}
      >
        {/* Time markers */}
        <div className="flex border-b h-8">
          {Array.from({ length: Math.ceil(durationInFrames / 30) }).map((_, i) => (
            <div
              key={i}
              className="text-xs text-muted-foreground px-2 flex items-center"
              style={{ minWidth: `${(30 / durationInFrames) * 100}%` }}
            >
              {i}s
            </div>
          ))}
        </div>

        {/* Playhead */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-primary z-10 pointer-events-none"
          style={{
            left: `${(currentFrame / durationInFrames) * 100}%`,
          }}
        >
          <div className="w-3 h-3 bg-primary rounded-full -translate-x-1/2" />
        </div>

        {/* Rows */}
        {Array.from({ length: visibleRows }).map((_, rowIndex) => (
          <div
            key={rowIndex}
            className="border-b"
            style={{ height: `${ROW_HEIGHT}px` }}
          >
            {overlays
              .filter((o) => o.row === rowIndex)
              .map((overlay) => (
                <div
                  key={overlay.id}
                  className={`absolute rounded px-2 py-1 text-xs cursor-pointer transition-all ${getOverlayColor(
                    overlay
                  )} ${
                    selectedOverlayId === overlay.id
                      ? "ring-2 ring-primary"
                      : "opacity-80 hover:opacity-100"
                  }`}
                  style={{
                    left: `${(overlay.from / durationInFrames) * 100}%`,
                    width: `${(overlay.durationInFrames / durationInFrames) * 100}%`,
                    top: `${rowIndex * ROW_HEIGHT + 8}px`,
                    height: `${ROW_HEIGHT - 16}px`,
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedOverlayId(overlay.id);
                  }}
                >
                  <span className="text-white font-medium truncate block">
                    {overlay.type === "text" ? overlay.content : overlay.type}
                  </span>
                </div>
              ))}
          </div>
        ))}
      </div>
    </Card>
  );
};
