import { useEffect, useRef, useState } from "react";
import { Canvas as FabricCanvas, Text, Image as FabricImage } from "fabric";
import { VideoClip } from "@/pages/content-studio/VideoEditor";

interface VideoEditorCanvasProps {
  format: { name: string; width: number; height: number };
  clips: VideoClip[];
  currentTime: number;
  isPlaying: boolean;
}

export const VideoEditorCanvas = ({ 
  format, 
  clips, 
  currentTime, 
  isPlaying 
}: VideoEditorCanvasProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const fabricCanvasRef = useRef<FabricCanvas | null>(null);
  const animationFrameRef = useRef<number>();
  const [activeClip, setActiveClip] = useState<VideoClip | null>(null);

  // Initialize Fabric.js canvas for overlays
  useEffect(() => {
    if (!overlayCanvasRef.current || fabricCanvasRef.current) return;

    const fabricCanvas = new FabricCanvas(overlayCanvasRef.current, {
      width: format.width,
      height: format.height,
      selection: false,
      renderOnAddRemove: true,
    });

    fabricCanvasRef.current = fabricCanvas;

    return () => {
      fabricCanvas.dispose();
      fabricCanvasRef.current = null;
    };
  }, [format.width, format.height]);

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
          selectable: false,
        });
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
            selectable: false,
          });
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
  const scale = containerRef.current 
    ? Math.min(
        (containerRef.current.clientWidth - 32) / format.width,
        (containerRef.current.clientHeight - 32) / format.height,
        1
      )
    : 0.5;

  return (
    <div 
      ref={containerRef} 
      className="flex-1 flex items-center justify-center bg-muted/30 p-4 overflow-auto"
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
            pointerEvents: 'none',
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
