import { useEffect, useRef, useState } from "react";
import { Canvas as FabricCanvas, Text, Image as FabricImage } from "fabric";
import { VideoClip } from "@/lib/video-editor/legacy-types";

interface VideoEditorCanvasProps {
  format: { name: string; width: number; height: number };
  clips: VideoClip[];
  currentTime: number;
  isPlaying: boolean;
  onClipsChange?: (clips: VideoClip[]) => void;
}

export const VideoEditorCanvas = ({ 
  format, 
  clips, 
  currentTime, 
  isPlaying,
  onClipsChange
}: VideoEditorCanvasProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const fabricCanvasRef = useRef<FabricCanvas | null>(null);
  const animationFrameRef = useRef<number>();
  const [activeClip, setActiveClip] = useState<VideoClip | null>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  // Track container size for scaling
  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      const container = entries[0];
      if (container) {
        setContainerSize({
          width: container.contentRect.width,
          height: container.contentRect.height,
        });
      }
    });

    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  // Initialize Fabric.js canvas for overlays
  useEffect(() => {
    if (!overlayCanvasRef.current || fabricCanvasRef.current) return;

    const fabricCanvas = new FabricCanvas(overlayCanvasRef.current, {
      width: format.width,
      height: format.height,
      selection: !isPlaying,
      renderOnAddRemove: true,
    });

    fabricCanvasRef.current = fabricCanvas;

    // Handle object modifications
    fabricCanvas.on('object:modified', (e) => {
      if (!e.target || !onClipsChange) return;
      
      const obj = e.target as any;
      const clipId = obj.clipId;
      
      if (!clipId) return;

      const updatedClips = clips.map(clip => {
        if (clip.id !== clipId) return clip;
        
        return {
          ...clip,
          transform: {
            ...clip.transform!,
            x: (obj.left! / format.width) * 100,
            y: (obj.top! / format.height) * 100,
            scale: obj.scaleX || 1,
            rotation: obj.angle || 0,
          }
        };
      });
      
      onClipsChange(updatedClips);
    });

    return () => {
      fabricCanvas.dispose();
      fabricCanvasRef.current = null;
    };
  }, [format.width, format.height]);

  // Update selection based on playback state
  useEffect(() => {
    if (fabricCanvasRef.current) {
      fabricCanvasRef.current.selection = !isPlaying;
      fabricCanvasRef.current.getObjects().forEach(obj => {
        obj.selectable = !isPlaying;
        obj.evented = !isPlaying;
      });
      fabricCanvasRef.current.renderAll();
    }
  }, [isPlaying]);

  // Find active video clip at current time
  useEffect(() => {
    const videoClips = clips.filter(c => c.type === 'video');
    const active = videoClips.find(clip => 
      currentTime >= clip.startTime && 
      currentTime < clip.startTime + clip.duration
    );
    
    setActiveClip(active || null);
  }, [clips, currentTime]);

  // Sync video playback
  useEffect(() => {
    if (!videoRef.current || !activeClip) return;

    const video = videoRef.current;
    const offsetTime = currentTime - activeClip.startTime;
    const videoTime = (activeClip.trimStart || 0) + offsetTime;

    // Only seek if difference is significant (> 0.1s) to avoid constant seeking
    if (Math.abs(video.currentTime - videoTime) > 0.1) {
      video.currentTime = videoTime;
    }

    if (isPlaying) {
      video.play().catch(err => console.error('Play error:', err));
    } else {
      video.pause();
    }
  }, [activeClip, currentTime, isPlaying]);

  // Render overlays (text, images)
  const renderOverlays = () => {
    const fabricCanvas = fabricCanvasRef.current;
    if (!fabricCanvas) return;

    // Don't clear if user is actively selecting/moving an object
    const activeObject = fabricCanvas.getActiveObject();
    if (activeObject) return;

    fabricCanvas.clear();

    // Get active overlay clips
    const activeOverlays = clips.filter(clip => 
      ['text', 'image'].includes(clip.type) &&
      currentTime >= clip.startTime &&
      currentTime <= clip.startTime + clip.duration
    );

    activeOverlays.forEach(clip => {
      if (clip.type === 'text' && clip.text && clip.textStyle && clip.transform) {
        const text = new Text(clip.text, {
          left: (format.width * clip.transform.x) / 100,
          top: (format.height * clip.transform.y) / 100,
          fontSize: clip.textStyle.fontSize,
          fill: clip.textStyle.color,
          fontFamily: clip.textStyle.fontFamily,
          fontWeight: clip.textStyle.fontWeight,
          textAlign: clip.textStyle.textAlign,
          originX: 'center',
          originY: 'center',
          selectable: !isPlaying,
          hasControls: true,
          hasBorders: true,
        });
        (text as any).clipId = clip.id;
        fabricCanvas.add(text);
      }

      if (clip.type === 'image' && clip.url && clip.transform) {
        FabricImage.fromURL(clip.url, {
          crossOrigin: 'anonymous',
        }).then((img) => {
          if (!img) return;
          
          img.set({
            left: (format.width * clip.transform!.x) / 100,
            top: (format.height * clip.transform!.y) / 100,
            scaleX: clip.transform!.scale,
            scaleY: clip.transform!.scale,
            angle: clip.transform!.rotation,
            originX: 'center',
            originY: 'center',
            selectable: !isPlaying,
            hasControls: true,
            hasBorders: true,
          });
          (img as any).clipId = clip.id;
          fabricCanvas.add(img);
          fabricCanvas.renderAll();
        });
      }
    });

    fabricCanvas.renderAll();
  };

  // Animation loop for overlays when playing
  useEffect(() => {
    if (isPlaying) {
      const animate = () => {
        renderOverlays();
        animationFrameRef.current = requestAnimationFrame(animate);
      };
      animate();
    } else {
      renderOverlays();
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying, currentTime, clips, format]);

  // Calculate scale to fit in container
  const scale = containerSize.width > 0 && containerSize.height > 0
    ? Math.min(
        (containerSize.width - 32) / format.width,
        (containerSize.height - 32) / format.height,
        1
      )
    : 0.5;

  return (
    <div 
      ref={containerRef} 
      className="flex-1 flex items-center justify-center bg-muted/30 p-4 overflow-hidden max-h-[calc(100vh-280px)]"
    >
      <div 
        className="relative" 
        style={{ 
          width: format.width * scale, 
          height: format.height * scale 
        }}
      >
        {/* Video layer */}
        <video
          ref={videoRef}
          src={activeClip?.url || ''}
          crossOrigin="anonymous"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: '#000',
            borderRadius: '8px',
            objectFit: 'contain',
          }}
        />

        {/* Overlay canvas */}
        <canvas
          ref={overlayCanvasRef}
          width={format.width}
          height={format.height}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            pointerEvents: isPlaying ? 'none' : 'auto',
          }}
        />

        {clips.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center text-muted-foreground bg-background/80 backdrop-blur-sm p-6 rounded-lg">
              <p className="text-lg font-medium">No clips added</p>
              <p className="text-sm">Import a video to get started</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
