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
  const [isDraggingClip, setIsDraggingClip] = useState(false);
  const [draggedClip, setDraggedClip] = useState<{ clip: TimelineClip; trackId: string } | null>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const [resizingClip, setResizingClip] = useState<{ clip: TimelineClip; trackId: string; edge: 'start' | 'end' } | null>(null);
  const [dragOverTrackId, setDragOverTrackId] = useState<string | null>(null);
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

  const handleClipMouseDown = (clip: TimelineClip, trackId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!timelineRef.current) return;
    
    const rect = timelineRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left - 150; // Subtract label width
    const clipStartX = clip.start * pixelsPerSecond;
    
    setDragOffset(clickX - clipStartX);
    setDraggedClip({ clip, trackId });
    setIsDraggingClip(true);
    onClipSelect(clip.id);
  };

  const handleResizeMouseDown = (clip: TimelineClip, trackId: string, edge: 'start' | 'end', e: React.MouseEvent) => {
    e.stopPropagation();
    setResizingClip({ clip, trackId, edge });
    onClipSelect(clip.id);
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
      if (isDraggingPlayhead && timelineRef.current) {
        const rect = timelineRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left - 150; // Subtract label width
        const time = Math.max(0, Math.min(project.duration, (x / timelineWidth) * project.duration));
        onProjectUpdate({ currentTime: time });
      }

      if (resizingClip && timelineRef.current) {
        const rect = timelineRef.current.getBoundingClientRect();
        const mouseX = e.clientX - rect.left - 150;
        const newTime = Math.max(0, Math.min(project.duration, mouseX / pixelsPerSecond));

        const updatedTracks = project.tracks.map(t => {
          if (t.id === resizingClip.trackId) {
            return {
              ...t,
              clips: t.clips.map(c => {
                if (c.id === resizingClip.clip.id) {
                  if (resizingClip.edge === 'start') {
                    const newStart = Math.min(newTime, c.end - 0.1);
                    return { ...c, start: newStart };
                  } else {
                    const newEnd = Math.max(newTime, c.start + 0.1);
                    return { ...c, end: newEnd };
                  }
                }
                return c;
              })
            };
          }
          return t;
        });

        onProjectUpdate({ tracks: updatedTracks });
      }

      if (isDraggingClip && draggedClip && timelineRef.current) {
        const rect = timelineRef.current.getBoundingClientRect();
        const mouseX = e.clientX - rect.left - 150 - dragOffset;
        const newStart = Math.max(0, mouseX / pixelsPerSecond);
        const duration = draggedClip.clip.end - draggedClip.clip.start;
        const newEnd = Math.min(project.duration, newStart + duration);

        // Detect which track we're hovering over
        const mouseY = e.clientY;
        const tracks = project.tracks.filter(track => track.id === 'video-1' || track.clips.length > 0);
        let targetTrackId = draggedClip.trackId;

        for (const track of tracks) {
          const trackElement = document.querySelector(`[data-track-id="${track.id}"]`);
          if (trackElement) {
            const trackRect = trackElement.getBoundingClientRect();
            if (mouseY >= trackRect.top && mouseY <= trackRect.bottom) {
              targetTrackId = track.id;
              break;
            }
          }
        }

        setDragOverTrackId(targetTrackId);

        // Update clip position and potentially move to different track
        const updatedTracks = project.tracks.map(t => {
          // Remove from old track
          if (t.id === draggedClip.trackId) {
            return {
              ...t,
              clips: t.clips.filter(c => c.id !== draggedClip.clip.id)
            };
          }
          // Add to new track
          if (t.id === targetTrackId) {
            const clipExists = t.clips.some(c => c.id === draggedClip.clip.id);
            if (!clipExists) {
              return {
                ...t,
                clips: [...t.clips, { ...draggedClip.clip, start: newStart, end: newEnd }]
              };
            } else {
              return {
                ...t,
                clips: t.clips.map(c => 
                  c.id === draggedClip.clip.id 
                    ? { ...c, start: newStart, end: newEnd }
                    : c
                )
              };
            }
          }
          return t;
        });

        onProjectUpdate({ tracks: updatedTracks });
        
        // Update the dragged clip's track reference
        if (targetTrackId !== draggedClip.trackId) {
          setDraggedClip({ ...draggedClip, trackId: targetTrackId });
        }
      }
    };

    const handleMouseUp = () => {
      if (isDraggingClip && draggedClip) {
        toast.success("Clip repositioned");
      }
      if (resizingClip) {
        toast.success("Clip resized");
      }
      setIsDraggingPlayhead(false);
      setIsDraggingClip(false);
      setDraggedClip(null);
      setResizingClip(null);
      setDragOverTrackId(null);
    };

    if (isDraggingPlayhead || isDraggingClip || resizingClip) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingPlayhead, isDraggingClip, resizingClip, draggedClip, dragOffset, timelineWidth, pixelsPerSecond, project.duration, project.tracks, onProjectUpdate]);

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

          {/* Tracks - Only show tracks with clips or main video track */}
          {project.tracks
            .filter(track => track.id === 'video-1' || track.clips.length > 0)
            .map((track) => (
            <div 
              key={track.id} 
              className={`flex border-b border-border transition-colors ${
                dragOverTrackId === track.id ? 'bg-primary/10' : ''
              }`} 
              style={{ height: track.height }}
              data-track-id={track.id}
            >
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
                      } ${getClipColor(clip.type)} hover:opacity-90 cursor-move overflow-hidden transition-opacity group`}
                      style={{
                        left: clip.start * pixelsPerSecond,
                        width: (clip.end - clip.start) * pixelsPerSecond,
                        opacity: isDraggingClip && draggedClip?.clip.id === clip.id ? 0.5 : 1,
                      }}
                      onClick={(e) => handleClipClick(clip.id, e)}
                      onMouseDown={(e) => handleClipMouseDown(clip, track.id, e)}
                      title={`${clip.type}: ${clip.start.toFixed(1)}s - ${clip.end.toFixed(1)}s (drag to move, edges to resize)`}
                    >
                      {/* Left resize handle */}
                      <div 
                        className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize bg-primary/0 hover:bg-primary/50 group-hover:bg-primary/30 transition-colors z-10"
                        onMouseDown={(e) => handleResizeMouseDown(clip, track.id, 'start', e)}
                        onClick={(e) => e.stopPropagation()}
                      />
                      
                      <div className="px-2 py-1 text-xs text-white font-medium truncate pointer-events-none">
                        {clip.type === 'text' && clip.content?.text ? clip.content.text : clip.type}
                      </div>
                      
                      {/* Right resize handle */}
                      <div 
                        className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize bg-primary/0 hover:bg-primary/50 group-hover:bg-primary/30 transition-colors z-10"
                        onMouseDown={(e) => handleResizeMouseDown(clip, track.id, 'end', e)}
                        onClick={(e) => e.stopPropagation()}
                      />
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
