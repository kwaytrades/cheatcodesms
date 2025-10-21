import { useRef, useEffect } from "react";
import { VideoClip } from "@/pages/content-studio/VideoEditor";
import { ScrollArea } from "@/components/ui/scroll-area";

interface VideoEditorTimelineProps {
  clips: VideoClip[];
  currentTime: number;
  duration: number;
  onClipsChange: (clips: VideoClip[]) => void;
  onTimeChange: (time: number) => void;
}

export const VideoEditorTimeline = ({
  clips,
  currentTime,
  duration,
  onClipsChange,
  onTimeChange,
}: VideoEditorTimelineProps) => {
  const timelineRef = useRef<HTMLDivElement>(null);
  const pixelsPerSecond = 50; // Zoom level

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const time = x / pixelsPerSecond;
    onTimeChange(Math.max(0, Math.min(duration, time)));
  };

  const timelineWidth = Math.max(duration * pixelsPerSecond, 1000);

  return (
    <div className="border-t border-border bg-card">
      <ScrollArea className="h-[200px]">
        <div className="p-4">
          {/* Time ruler */}
          <div className="relative h-8 border-b border-border mb-4" style={{ width: timelineWidth }}>
            {Array.from({ length: Math.ceil(duration) + 1 }).map((_, i) => (
              <div
                key={i}
                className="absolute top-0 flex flex-col items-center"
                style={{ left: i * pixelsPerSecond }}
              >
                <div className="h-2 w-px bg-border" />
                <span className="text-xs text-muted-foreground">{i}s</span>
              </div>
            ))}
          </div>

          {/* Timeline tracks */}
          <div
            ref={timelineRef}
            className="relative cursor-pointer"
            style={{ width: timelineWidth, minHeight: '100px' }}
            onClick={handleTimelineClick}
          >
            {/* Playhead */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-primary z-10 pointer-events-none"
              style={{ left: currentTime * pixelsPerSecond }}
            >
              <div className="absolute -top-2 -left-2 w-4 h-4 bg-primary rounded-full" />
            </div>

            {/* Clips */}
            {clips.map((clip, index) => (
              <div
                key={clip.id}
                className="absolute h-16 bg-primary/20 border-2 border-primary rounded flex items-center px-2 hover:bg-primary/30 transition-colors cursor-move"
                style={{
                  left: clip.startTime * pixelsPerSecond,
                  width: clip.duration * pixelsPerSecond || 100,
                  top: clip.track * 70,
                }}
              >
                <span className="text-xs font-medium truncate">
                  Clip {index + 1}
                </span>
              </div>
            ))}

            {clips.length === 0 && (
              <div className="flex items-center justify-center h-24 text-muted-foreground text-sm">
                Timeline empty - add clips to start editing
              </div>
            )}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
};
