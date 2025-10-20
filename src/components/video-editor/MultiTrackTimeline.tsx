import { useRef, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Play, Pause, SkipBack, SkipForward, ZoomIn, ZoomOut } from "lucide-react";
import { VideoProject, Track, TimelineClip } from "@/pages/content-studio/VideoEditor";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";

interface MultiTrackTimelineProps {
  project: VideoProject;
  selectedClipId: string | null;
  activeTool: string;
  onProjectUpdate: (updates: Partial<VideoProject>) => void;
  onClipSelect: (clipId: string | null) => void;
}

export const MultiTrackTimeline = ({
  project,
  selectedClipId,
  activeTool,
  onProjectUpdate,
  onClipSelect,
}: MultiTrackTimelineProps) => {
  const timelineRef = useRef<HTMLDivElement>(null);
  const [pixelsPerSecond, setPixelsPerSecond] = useState(100);
  const [isDraggingPlayhead, setIsDraggingPlayhead] = useState(false);
  const timelineWidth = project.duration * pixelsPerSecond;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handlePlayPause = () => {
    onProjectUpdate({ isPlaying: !project.isPlaying });
  };

  const handleSkip = (delta: number) => {
    const newTime = Math.max(0, Math.min(project.duration, project.currentTime + delta));
    onProjectUpdate({ currentTime: newTime });
  };

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const time = (x / timelineWidth) * project.duration;
    onProjectUpdate({ currentTime: time });
  };

  const handleSplitSelectedClip = () => {
    if (!selectedClipId) {
      toast.error("Select a clip first to split it");
      return;
    }

    let clipToSplit: TimelineClip | null = null;
    let trackId: string | null = null;

    for (const track of project.tracks) {
      const clip = track.clips.find(c => c.id === selectedClipId);
      if (clip) {
        clipToSplit = clip;
        trackId = track.id;
        break;
      }
    }

    if (!clipToSplit || !trackId) {
      toast.error("Selected clip not found");
      return;
    }

    const splitTime = project.currentTime;

    if (splitTime <= clipToSplit.start || splitTime >= clipToSplit.end) {
      toast.error("Playhead must be within the selected clip to split");
      return;
    }

    const updatedTracks = project.tracks.map(t => {
      if (t.id === trackId) {
        const newClips = t.clips.flatMap(clip => {
          if (clip.id === clipToSplit!.id) {
            return [
              { ...clip, end: splitTime },
              {
                ...clip,
                id: `${clip.id}-split-${Date.now()}`,
                start: splitTime,
              }
            ];
          }
          return clip;
        });
        return { ...t, clips: newClips };
      }
      return t;
    });

    onProjectUpdate({ tracks: updatedTracks });
    onClipSelect(null);
    toast.success("Clip split successfully");
  };

  const handleClipClick = (clipId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onClipSelect(clipId);
  };

  const handleZoom = (direction: 'in' | 'out') => {
    setPixelsPerSecond(prev => {
      const newValue = direction === 'in' ? prev * 1.2 : prev / 1.2;
      return Math.max(20, Math.min(500, newValue));
    });
  };

  const handlePlayheadMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingPlayhead(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingPlayhead || !timelineRef.current) return;

      const rect = timelineRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left - 150; // Subtract label width
      const time = Math.max(0, Math.min(project.duration, (x / timelineWidth) * project.duration));
      onProjectUpdate({ currentTime: time });
    };

    const handleMouseUp = () => {
      setIsDraggingPlayhead(false);
    };

    if (isDraggingPlayhead) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingPlayhead, timelineWidth, project.duration, onProjectUpdate]);

  const getClipColor = (type: string) => {
    switch (type) {
      case 'video': return 'bg-blue-500/70';
      case 'audio': return 'bg-green-500/70';
      case 'text': return 'bg-purple-500/70';
      case 'sticker': return 'bg-orange-500/70';
      case 'image': return 'bg-cyan-500/70';
      default: return 'bg-gray-500/70';
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Playback Controls */}
      <div className="flex-none border-b border-border p-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={() => handleSkip(-5)} className="h-8 w-8 p-0">
              <SkipBack className="h-4 w-4" />
            </Button>
            <Button size="sm" onClick={handlePlayPause} className="h-8 w-8 p-0">
              {project.isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => handleSkip(5)} className="h-8 w-8 p-0">
              <SkipForward className="h-4 w-4" />
            </Button>
            <span className="text-sm tabular-nums ml-2">
              {formatTime(project.currentTime)} / {formatTime(project.duration)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {activeTool === 'split' && (
              <Button 
                size="sm" 
                variant="default" 
                onClick={handleSplitSelectedClip}
                disabled={!selectedClipId}
                className="h-8"
              >
                Split at Playhead
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => handleZoom('out')} className="h-8 w-8 p-0">
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="text-xs text-muted-foreground">{Math.round((pixelsPerSecond / 100) * 100)}%</span>
            <Button size="sm" variant="ghost" onClick={() => handleZoom('in')} className="h-8 w-8 p-0">
              <ZoomIn className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Timeline Tracks */}
      <ScrollArea className="flex-1">
        <div ref={timelineRef} className="relative" style={{ width: timelineWidth + 200, minHeight: '100%' }}>
          {/* Time Ruler */}
          <div className="sticky top-0 z-10 bg-card border-b border-border h-8 flex items-center" style={{ width: timelineWidth + 200 }}>
            <div className="w-[150px] flex-none" />
            <div className="relative flex-1">
              {Array.from({ length: Math.ceil(project.duration) + 1 }).map((_, i) => (
                <div
                  key={i}
                  className="absolute top-0 h-full border-l border-border/50"
                  style={{ left: i * pixelsPerSecond }}
                >
                  <span className="text-xs text-muted-foreground ml-1">{formatTime(i)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Tracks */}
          {project.tracks.map((track) => (
            <div key={track.id} className="flex border-b border-border" style={{ height: track.height }}>
              {/* Track Label */}
              <div className="w-[150px] flex-none border-r border-border p-2 flex items-center bg-muted/30">
                <span className="text-xs font-medium truncate">{track.name}</span>
              </div>

              {/* Track Content */}
              <div 
                className="relative flex-1 bg-muted/10 hover:bg-muted/20 cursor-pointer"
                style={{ width: timelineWidth }}
                onClick={(e) => handleTimelineClick(e)}
              >
                {track.clips
                  .filter(clip => clip.enabled)
                  .map((clip) => (
                    <div
                      key={clip.id}
                      className={`absolute top-1 bottom-1 rounded border-2 ${
                        selectedClipId === clip.id ? 'border-primary' : 'border-transparent'
                      } ${getClipColor(clip.type)} hover:opacity-90 cursor-pointer overflow-hidden`}
                      style={{
                        left: clip.start * pixelsPerSecond,
                        width: (clip.end - clip.start) * pixelsPerSecond,
                      }}
                      onClick={(e) => handleClipClick(clip.id, e)}
                      title={`${clip.type}: ${clip.start.toFixed(1)}s - ${clip.end.toFixed(1)}s`}
                    >
                      <div className="px-2 py-1 text-xs text-white font-medium truncate">
                        {clip.type === 'text' && clip.content?.text ? clip.content.text : clip.type}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          ))}

          {/* Playhead - Draggable */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-destructive z-20 cursor-ew-resize"
            style={{
              left: 150 + (project.currentTime * pixelsPerSecond),
            }}
            onMouseDown={handlePlayheadMouseDown}
          >
            <div 
              className="absolute -top-1 -left-1.5 w-3 h-3 bg-destructive rounded-full cursor-pointer hover:scale-125 transition-transform"
              onMouseDown={handlePlayheadMouseDown}
            />
          </div>
        </div>
      </ScrollArea>
    </div>
  );
};
