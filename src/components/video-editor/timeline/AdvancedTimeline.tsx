import React, { useEffect, useState } from "react";
import { DndContext, DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { useTimeline } from "@/contexts/video-editor/TimelineContext";
import { useEditorContext } from "@/contexts/video-editor/EditorContext";
import { Card } from "@/components/ui/card";
import { ROW_HEIGHT } from "@/lib/video-editor/constants";
import { TimelineItem } from "./TimelineItem";
import { useTimelineDrag } from "@/hooks/video-editor/useTimelineDrag";

interface TimelineProps {
  onTimelineClick: (e: React.MouseEvent<HTMLDivElement>) => void;
}

export const AdvancedTimeline: React.FC<TimelineProps> = ({ onTimelineClick }) => {
  const { timelineRef, zoomScale, visibleRows } = useTimeline();
  const { overlays, currentFrame, durationInFrames, selectedOverlayId, setSelectedOverlayId, changeOverlay } =
    useEditorContext();
  
  const [timelineWidth, setTimelineWidth] = useState(0);

  useEffect(() => {
    if (timelineRef.current) {
      const observer = new ResizeObserver((entries) => {
        if (entries[0]) {
          setTimelineWidth(entries[0].contentRect.width);
        }
      });
      observer.observe(timelineRef.current);
      return () => observer.disconnect();
    }
  }, [timelineRef]);

  const { handleDragEnd } = useTimelineDrag({
    overlays,
    changeOverlay,
    durationInFrames,
    timelineWidth,
  });

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  return (
    <Card className="p-4">
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
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
              className="border-b relative"
              style={{ height: `${ROW_HEIGHT}px` }}
            >
              {overlays
                .filter((o) => o.row === rowIndex)
                .map((overlay) => (
                  <TimelineItem
                    key={overlay.id}
                    overlay={overlay}
                    durationInFrames={durationInFrames}
                    isSelected={selectedOverlayId === overlay.id}
                    onSelect={() => setSelectedOverlayId(overlay.id)}
                    rowHeight={ROW_HEIGHT}
                    timelineWidth={timelineWidth}
                  />
                ))}
            </div>
          ))}
        </div>
      </DndContext>
    </Card>
  );
};
