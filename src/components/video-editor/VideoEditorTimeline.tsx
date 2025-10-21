import { useRef, useEffect, useState } from "react";
import { VideoClip } from "@/pages/content-studio/VideoEditor";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Canvas as FabricCanvas, Rect, Line, Text, FabricObject } from "fabric";
import { Button } from "@/components/ui/button";
import { Trash2, ZoomIn, ZoomOut } from "lucide-react";
import { toast } from "sonner";

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
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricCanvasRef = useRef<FabricCanvas | null>(null);
  const [selectedClip, setSelectedClip] = useState<string | null>(null);
  const [pixelsPerSecond, setPixelsPerSecond] = useState(50);

  const TRACK_HEIGHT = 60;
  const TIMELINE_HEIGHT = 200;
  const RULER_HEIGHT = 30;

  // Initialize Fabric.js canvas
  useEffect(() => {
    if (!canvasRef.current || fabricCanvasRef.current) return;

    const timelineWidth = Math.max(duration * pixelsPerSecond, 1000);
    
    const fabricCanvas = new FabricCanvas(canvasRef.current, {
      width: timelineWidth,
      height: TIMELINE_HEIGHT,
      backgroundColor: 'hsl(var(--muted))',
      selection: false,
    });

    fabricCanvasRef.current = fabricCanvas;

    // Click on canvas background to seek
    fabricCanvas.on('mouse:down', (e) => {
      if (!e.target) {
        const pointer = fabricCanvas.getPointer(e.e);
        const time = pointer.x / pixelsPerSecond;
        onTimeChange(Math.max(0, Math.min(duration, time)));
      }
    });

    return () => {
      fabricCanvas.dispose();
      fabricCanvasRef.current = null;
    };
  }, []);

  // Update canvas width when duration or zoom changes
  useEffect(() => {
    if (!fabricCanvasRef.current) return;
    const timelineWidth = Math.max(duration * pixelsPerSecond, 1000);
    fabricCanvasRef.current.setWidth(timelineWidth);
    renderTimeline();
  }, [duration, pixelsPerSecond]);

  // Render timeline elements
  const renderTimeline = () => {
    const fabricCanvas = fabricCanvasRef.current;
    if (!fabricCanvas) return;

    fabricCanvas.clear();
    fabricCanvas.backgroundColor = 'hsl(var(--muted))';

    const timelineWidth = Math.max(duration * pixelsPerSecond, 1000);

    // Draw time ruler
    const rulerCount = Math.ceil(duration) + 1;
    for (let i = 0; i < rulerCount; i++) {
      const x = i * pixelsPerSecond;
      
      // Vertical line
      const line = new Line([x, 0, x, RULER_HEIGHT], {
        stroke: 'hsl(var(--border))',
        strokeWidth: 1,
        selectable: false,
        evented: false,
      });
      fabricCanvas.add(line);

      // Time label
      const text = new Text(`${i}s`, {
        left: x + 4,
        top: 8,
        fontSize: 12,
        fill: 'hsl(var(--muted-foreground))',
        selectable: false,
        evented: false,
      });
      fabricCanvas.add(text);
    }

    // Draw clips on tracks
    clips.forEach((clip, index) => {
      const clipRect = new Rect({
        left: clip.startTime * pixelsPerSecond,
        top: RULER_HEIGHT + (clip.track * TRACK_HEIGHT) + 10,
        width: clip.duration * pixelsPerSecond || 100,
        height: TRACK_HEIGHT - 20,
        fill: clip.id.startsWith('text-') 
          ? 'hsl(var(--primary) / 0.6)' 
          : clip.id.startsWith('image-')
          ? 'hsl(var(--accent) / 0.6)'
          : 'hsl(var(--primary) / 0.4)',
        stroke: selectedClip === clip.id ? 'hsl(var(--primary))' : 'hsl(var(--border))',
        strokeWidth: selectedClip === clip.id ? 3 : 1,
        rx: 4,
        ry: 4,
      });

      // Store clip ID for reference
      clipRect.set('clipId', clip.id);

      // Clip label
      const clipLabel = new Text(
        clip.id.startsWith('text-') ? 'Text' : 
        clip.id.startsWith('image-') ? 'Image' : 
        `Clip ${index + 1}`,
        {
          left: (clip.startTime * pixelsPerSecond) + 8,
          top: RULER_HEIGHT + (clip.track * TRACK_HEIGHT) + 25,
          fontSize: 14,
          fill: '#ffffff',
          selectable: false,
          evented: false,
          fontWeight: 'bold',
        }
      );

      fabricCanvas.add(clipRect, clipLabel);

      // Make clip draggable
      clipRect.on('mousedown', () => {
        setSelectedClip(clip.id);
      });

      clipRect.on('moving', (e: any) => {
        const obj = e.target as FabricObject;
        if (!obj) return;
        
        // Constrain vertical movement to tracks
        const trackIndex = Math.round((obj.top! - RULER_HEIGHT - 10) / TRACK_HEIGHT);
        obj.top = RULER_HEIGHT + (trackIndex * TRACK_HEIGHT) + 10;
        
        // Constrain horizontal movement
        obj.left = Math.max(0, obj.left!);
        
        fabricCanvas.renderAll();
      });

      clipRect.on('modified', (e) => {
        const obj = e.target as FabricObject;
        if (!obj) return;
        
        const clipId = (obj as any).clipId;
        const newStartTime = obj.left! / pixelsPerSecond;
        const newTrack = Math.round((obj.top! - RULER_HEIGHT - 10) / TRACK_HEIGHT);
        
        // Update clip position
        const updatedClips = clips.map(c => 
          c.id === clipId 
            ? { ...c, startTime: newStartTime, track: newTrack }
            : c
        );
        onClipsChange(updatedClips);
        toast.success("Clip position updated");
      });

      clipRect.set({
        lockRotation: true,
        lockScalingX: false,
        lockScalingY: true,
        hasControls: true,
      });
    });

    // Draw playhead
    const playheadX = currentTime * pixelsPerSecond;
    const playheadLine = new Line(
      [playheadX, 0, playheadX, TIMELINE_HEIGHT],
      {
        stroke: 'hsl(var(--primary))',
        strokeWidth: 2,
        selectable: false,
        evented: false,
      }
    );
    
    const playheadHandle = new Rect({
      left: playheadX - 6,
      top: 0,
      width: 12,
      height: 12,
      fill: 'hsl(var(--primary))',
      rx: 6,
      ry: 6,
      selectable: false,
      evented: false,
    });

    fabricCanvas.add(playheadLine, playheadHandle);
    fabricCanvas.renderAll();
  };

  // Re-render timeline when clips or currentTime change
  useEffect(() => {
    renderTimeline();
  }, [clips, currentTime, selectedClip, pixelsPerSecond]);

  const handleDeleteClip = () => {
    if (!selectedClip) {
      toast.error("No clip selected");
      return;
    }
    
    const updatedClips = clips.filter(c => c.id !== selectedClip);
    onClipsChange(updatedClips);
    setSelectedClip(null);
    toast.success("Clip deleted");
  };

  const handleZoomIn = () => {
    setPixelsPerSecond(prev => Math.min(prev + 10, 100));
  };

  const handleZoomOut = () => {
    setPixelsPerSecond(prev => Math.max(prev - 10, 20));
  };

  return (
    <div className="border-t border-border bg-card">
      <div className="flex items-center justify-between p-2 border-b border-border">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">Timeline</span>
          {selectedClip && (
            <Button
              size="sm"
              variant="destructive"
              onClick={handleDeleteClip}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Delete
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={handleZoomOut}>
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-xs text-muted-foreground">{pixelsPerSecond}px/s</span>
          <Button size="sm" variant="outline" onClick={handleZoomIn}>
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      <ScrollArea className="h-[200px]">
        <div className="p-4">
          <canvas ref={canvasRef} />
          {clips.length === 0 && (
            <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
              Timeline empty - add clips to start editing
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};
