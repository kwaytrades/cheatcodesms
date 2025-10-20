import { useRef, useEffect, useState, useLayoutEffect } from "react";
import ReactPlayer from "react-player";
import { Canvas as FabricCanvas, Text as FabricText, Image as FabricImage, Rect as FabricRect, FabricObject } from "fabric";
import { VideoProject, TimelineClip } from "@/pages/content-studio/VideoEditor";
import { Button } from "@/components/ui/button";

interface VideoEditorCanvasProps {
  project: VideoProject;
  selectedClipId: string | null;
  onTimeUpdate: (time: number) => void;
  onPlayingChange: (playing: boolean) => void;
  onProjectUpdate: (updates: Partial<VideoProject>) => void;
  onClipSelect: (clipId: string | null) => void;
}

export const VideoEditorCanvas = ({ 
  project, 
  selectedClipId, 
  onTimeUpdate, 
  onPlayingChange,
  onProjectUpdate,
  onClipSelect,
}: VideoEditorCanvasProps) => {
  const playerRef = useRef<ReactPlayer>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isMountedRef = useRef(false);
  const [fabricCanvas, setFabricCanvas] = useState<FabricCanvas | null>(null);
  const [isCanvasReady, setIsCanvasReady] = useState(false);
  const interactiveObjectsRef = useRef<Map<string, any>>(new Map());
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Get active video clip from video-1 track to determine what should be playing
  const getActiveVideoClip = (time: number): TimelineClip | null => {
    const videoTrack = project.tracks.find(t => t.id === 'video-1');
    if (!videoTrack) return null;
    
    return videoTrack.clips.find(c => 
      c.enabled && 
      time >= c.start && 
      time < c.end
    ) || null;
  };

  // Find next enabled clip after current time
  const findNextEnabledClip = (time: number): TimelineClip | null => {
    const videoTrack = project.tracks.find(t => t.id === 'video-1');
    if (!videoTrack) return null;
    
    const nextClips = videoTrack.clips
      .filter(c => c.enabled && c.start > time)
      .sort((a, b) => a.start - b.start);
    
    return nextClips[0] || null;
  };

  // Handle fabric object moving
  const handleObjectMoving = (e: any) => {
    const obj = e.target;
    const clipId = obj.data?.clipId;
    if (!clipId || !fabricCanvas) return;

    const xPercent = (obj.left / fabricCanvas.width!) * 100;
    const yPercent = (obj.top / fabricCanvas.height!) * 100;

    updateClipPosition(clipId, xPercent, yPercent, undefined, undefined);
  };

  // Handle fabric object scaling
  const handleObjectScaling = (e: any) => {
    const obj = e.target;
    const clipId = obj.data?.clipId;
    if (!clipId || !fabricCanvas) return;

    const widthPercent = ((obj.width! * obj.scaleX!) / fabricCanvas.width!) * 100;
    const heightPercent = ((obj.height! * obj.scaleY!) / fabricCanvas.height!) * 100;
    const xPercent = (obj.left / fabricCanvas.width!) * 100;
    const yPercent = (obj.top / fabricCanvas.height!) * 100;

    updateClipPosition(clipId, xPercent, yPercent, widthPercent, heightPercent);
  };

  // Handle object selection
  const handleObjectSelected = (e: any) => {
    const obj = e.selected?.[0];
    if (obj?.data?.clipId) {
      onClipSelect(obj.data.clipId);
    }
  };

  // Update clip position in project
  const updateClipPosition = (clipId: string, x: number, y: number, width?: number, height?: number) => {
    const updatedTracks = project.tracks.map(track => ({
      ...track,
      clips: track.clips.map(clip => {
        if (clip.id === clipId && clip.content?.position) {
          return {
            ...clip,
            content: {
              ...clip.content,
              position: {
                x: Math.round(x * 10) / 10,
                y: Math.round(y * 10) / 10,
                width: width !== undefined ? Math.round(width * 10) / 10 : clip.content.position.width,
                height: height !== undefined ? Math.round(height * 10) / 10 : clip.content.position.height,
              }
            }
          };
        }
        return clip;
      })
    }));

    onProjectUpdate({ tracks: updatedTracks });
  };

  // Initialize fabric canvas imperatively - ONLY ONCE on mount
  useLayoutEffect(() => {
    if (fabricCanvas || !canvasContainerRef.current) return;
    
    isMountedRef.current = true;

    // Create canvas element imperatively to avoid React reconciliation issues
    const canvasElement = document.createElement('canvas');
    canvasElement.className = 'absolute top-0 left-0 w-full h-full';
    canvasElement.style.mixBlendMode = 'normal';
    canvasElement.style.zIndex = '10';
    
    canvasRef.current = canvasElement;
    canvasContainerRef.current.appendChild(canvasElement);

    // Use double requestAnimationFrame to ensure DOM is ready
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!canvasRef.current || !isMountedRef.current || fabricCanvas) return;

        try {
          const canvas = new FabricCanvas(canvasRef.current, {
            width: 1920,
            height: 1080,
            backgroundColor: 'transparent',
            selection: true,
            renderOnAddRemove: false,
          });

          // Add event handlers for interactive objects
          canvas.on('object:moving', handleObjectMoving);
          canvas.on('object:scaling', handleObjectScaling);
          canvas.on('selection:created', handleObjectSelected);
          canvas.on('selection:updated', handleObjectSelected);

          setFabricCanvas(canvas);
          setIsCanvasReady(true);
        } catch (error) {
          console.error('Failed to initialize canvas:', error);
        }
      });
    });

    return () => {
      isMountedRef.current = false;
      
      // Clean up imperatively created canvas
      if (fabricCanvas) {
        try {
          fabricCanvas.dispose();
        } catch (error) {
          console.error('Error disposing canvas:', error);
        }
      }
      
      if (canvasRef.current && canvasContainerRef.current) {
        try {
          canvasContainerRef.current.removeChild(canvasRef.current);
        } catch (error) {
          console.error('Error removing canvas element:', error);
        }
      }
      
      canvasRef.current = null;
    };
  }, []); // Empty deps - only run once

  // Update canvas dimensions imperatively when canvas size changes
  useEffect(() => {
    if (!fabricCanvas || !isMountedRef.current || !isCanvasReady) return;
    
    // Use requestAnimationFrame to defer dimension updates
    const rafId = requestAnimationFrame(() => {
      if (!fabricCanvas || !isMountedRef.current) return;
      
      try {
        const currentWidth = fabricCanvas.width || 1920;
        const currentHeight = fabricCanvas.height || 1080;
        const scaleX = project.canvasSize.width / currentWidth;
        const scaleY = project.canvasSize.height / currentHeight;
        
        // Update canvas dimensions
        fabricCanvas.setDimensions({
          width: project.canvasSize.width,
          height: project.canvasSize.height,
        });
        
        // Update the underlying canvas element dimensions
        if (canvasRef.current) {
          canvasRef.current.width = project.canvasSize.width;
          canvasRef.current.height = project.canvasSize.height;
        }
        
        // Scale all objects proportionally
        fabricCanvas.getObjects().forEach((obj) => {
          obj.scaleX = (obj.scaleX || 1) * scaleX;
          obj.scaleY = (obj.scaleY || 1) * scaleY;
          obj.left = (obj.left || 0) * scaleX;
          obj.top = (obj.top || 0) * scaleY;
          obj.setCoords();
        });
        
        fabricCanvas.renderAll();
      } catch (error) {
        console.error('Error updating canvas dimensions:', error);
      }
    });
    
    return () => cancelAnimationFrame(rafId);
  }, [fabricCanvas, isCanvasReady, project.canvasSize.width, project.canvasSize.height]);

  // Update canvas overlays only when tracks change, not on every time update
  useEffect(() => {
    if (!isMountedRef.current || !isCanvasReady || !fabricCanvas) return;
    
    // Clear any pending updates
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }

    // Debounce canvas updates
    updateTimeoutRef.current = setTimeout(() => {
      if (!isMountedRef.current || !fabricCanvas) return;

      try {
        // Clear existing objects
        fabricCanvas.clear();
        interactiveObjectsRef.current.clear();

        // Get all clips that should be visible at current time
        const visibleClips = project.tracks.flatMap(track => 
          track.clips.filter(clip => 
            clip.enabled && 
            project.currentTime >= clip.start && 
            project.currentTime <= clip.end
          ).map(clip => ({ ...clip, trackType: track.type, trackId: track.id }))
        );

        // Add text overlays (non-interactive)
        visibleClips
          .filter(clip => clip.trackType === 'text' && clip.content?.text)
          .forEach((clip) => {
            const text = new FabricText(clip.content.text, {
              left: (clip.content.position?.x || 50) * (fabricCanvas.width! / 100),
              top: (clip.content.position?.y || 50) * (fabricCanvas.height! / 100),
              fontSize: clip.content.fontSize || 32,
              fontFamily: clip.content.fontFamily || 'Arial',
              fill: clip.content.color || '#ffffff',
              selectable: false,
            });
            fabricCanvas.add(text);
          });

        // Add stickers (non-interactive)
        visibleClips
          .filter(clip => clip.trackType === 'sticker' && clip.content?.emoji)
          .forEach((clip) => {
            const emoji = new FabricText(clip.content.emoji, {
              left: (clip.content.position?.x || 50) * (fabricCanvas.width! / 100),
              top: (clip.content.position?.y || 50) * (fabricCanvas.height! / 100),
              fontSize: 60 * ((clip.content.scale || 100) / 100),
              angle: clip.content.rotation || 0,
              selectable: false,
            });
            fabricCanvas.add(emoji);
          });

        // Add interactive image overlays
        const imagePromises = visibleClips
          .filter(clip => clip.type === 'image' && clip.sourceUrl)
          .map(async (clip) => {
            const position = clip.content?.position || { x: 70, y: 10, width: 25, height: 25 };
            
            try {
              const img = await FabricImage.fromURL(clip.sourceUrl!, {
                crossOrigin: 'anonymous'
              });

              if (!isMountedRef.current || !fabricCanvas) return;

              const canvasWidth = fabricCanvas.width!;
              const canvasHeight = fabricCanvas.height!;
              
              const targetWidth = (position.width / 100) * canvasWidth;
              const targetHeight = (position.height / 100) * canvasHeight;
              
              img.set({
                left: (position.x / 100) * canvasWidth,
                top: (position.y / 100) * canvasHeight,
                scaleX: targetWidth / img.width!,
                scaleY: targetHeight / img.height!,
                selectable: true,
                hasControls: true,
                hasBorders: true,
                lockRotation: false,
                borderColor: selectedClipId === clip.id ? '#3b82f6' : '#ffffff',
                borderScaleFactor: 2,
                cornerColor: '#3b82f6',
                cornerStrokeColor: '#ffffff',
                transparentCorners: false,
              });

              (img as any).data = { clipId: clip.id };
              
              fabricCanvas.add(img);
              interactiveObjectsRef.current.set(clip.id, img);
            } catch (err) {
              console.error('Error loading image:', err);
            }
          });

        // Add interactive video overlay rectangles (placeholders)
        visibleClips
          .filter(clip => clip.type === 'video' && clip.trackId !== 'video-1')
          .forEach((clip) => {
            const position = clip.content?.position || { x: 70, y: 10, width: 25, height: 25 };
            
            const rect = new FabricRect({
              left: (position.x / 100) * fabricCanvas.width!,
              top: (position.y / 100) * fabricCanvas.height!,
              width: (position.width / 100) * fabricCanvas.width!,
              height: (position.height / 100) * fabricCanvas.height!,
              fill: 'rgba(59, 130, 246, 0.1)',
              stroke: selectedClipId === clip.id ? '#3b82f6' : '#ffffff',
              strokeWidth: 2,
              selectable: true,
              hasControls: true,
              hasBorders: true,
              lockRotation: false,
              borderColor: selectedClipId === clip.id ? '#3b82f6' : '#ffffff',
              borderScaleFactor: 2,
              cornerColor: '#3b82f6',
              cornerStrokeColor: '#ffffff',
              transparentCorners: false,
            });

            (rect as any).data = { clipId: clip.id };
            
            fabricCanvas.add(rect);
            interactiveObjectsRef.current.set(clip.id, rect);
          });

        // Wait for all images to load, then render
        Promise.all(imagePromises).then(() => {
          if (isMountedRef.current && fabricCanvas) {
            fabricCanvas.renderAll();
          }
        });

      } catch (error) {
        console.error('Error updating canvas:', error);
      }
    }, 100);

    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, [fabricCanvas, isCanvasReady, JSON.stringify(project.tracks), selectedClipId]);

  // Separate effect to handle visibility during playback without clearing canvas
  useEffect(() => {
    if (!fabricCanvas || !isCanvasReady) return;

    // Update visibility of existing objects based on time
    fabricCanvas.getObjects().forEach((obj: any) => {
      if (!obj.data?.clipId) return;

      // Find the clip for this object
      const clip = project.tracks
        .flatMap(t => t.clips)
        .find(c => c.id === obj.data.clipId);

      if (clip) {
        const shouldBeVisible = clip.enabled && 
          project.currentTime >= clip.start && 
          project.currentTime <= clip.end;
        
        obj.visible = shouldBeVisible;
      }
    });

    fabricCanvas.renderAll();
  }, [fabricCanvas, isCanvasReady, project.currentTime]);

  // Apply CSS filters to video
  const getFilterStyle = () => {
    const { brightness, contrast, saturation, temperature } = project.filters;
    
    return {
      filter: `
        brightness(${brightness}%)
        contrast(${contrast}%)
        saturate(${saturation}%)
        hue-rotate(${temperature}deg)
      `,
    };
  };

  const handleProgress = ({ playedSeconds }: { playedSeconds: number }) => {
    const videoTrack = project.tracks.find(t => t.id === 'video-1');
    
    // If no video track or no clips, play normally
    if (!videoTrack || videoTrack.clips.length === 0) {
      if (playedSeconds >= project.duration) {
        onPlayingChange(false);
        playerRef.current?.seekTo(0);
      }
      onTimeUpdate(playedSeconds);
      return;
    }

    // Check if we're in an enabled clip segment
    const activeClip = getActiveVideoClip(playedSeconds);
    
    if (!activeClip) {
      // We're in a disabled/deleted section, skip to next enabled clip
      const nextClip = findNextEnabledClip(playedSeconds);
      if (nextClip) {
        playerRef.current?.seekTo(nextClip.start);
        onTimeUpdate(nextClip.start);
      } else {
        // No more clips, stop playback
        onPlayingChange(false);
        playerRef.current?.seekTo(0);
        onTimeUpdate(0);
      }
      return;
    }

    // Check if we've reached the end of current clip
    if (playedSeconds >= activeClip.end) {
      const nextClip = findNextEnabledClip(playedSeconds);
      if (nextClip) {
        playerRef.current?.seekTo(nextClip.start);
        onTimeUpdate(nextClip.start);
      } else {
        onPlayingChange(false);
        playerRef.current?.seekTo(0);
        onTimeUpdate(0);
      }
      return;
    }

    // Normal playback within active clip
    if (playedSeconds >= project.duration) {
      onPlayingChange(false);
      playerRef.current?.seekTo(0);
    }
    onTimeUpdate(playedSeconds);
  };

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center p-6">
      {/* Playback Controls */}
      <div className="flex items-center gap-3 mb-4">
        <Button size="sm" variant="outline" onClick={() => onTimeUpdate(Math.max(0, project.currentTime - 5))}>
          Skip -5s
        </Button>
        <Button onClick={() => onPlayingChange(!project.isPlaying)}>
          {project.isPlaying ? 'Pause' : 'Play'}
        </Button>
        <Button size="sm" variant="outline" onClick={() => onTimeUpdate(Math.min(project.duration, project.currentTime + 5))}>
          Skip +5s
        </Button>
        <span className="text-sm tabular-nums ml-2">
          {Math.floor(project.currentTime / 60)}:{Math.floor(project.currentTime % 60).toString().padStart(2, '0')} / {Math.floor(project.duration / 60)}:{Math.floor(project.duration % 60).toString().padStart(2, '0')}
        </span>
      </div>

      {/* Video Preview */}
      <div 
        className="relative bg-black rounded-lg overflow-hidden shadow-2xl" 
        style={{ 
          width: '100%',
          maxWidth: '900px',
          aspectRatio: project.canvasSize.aspectRatio.replace(':', '/'),
        }}
      >
        {/* Main Video */}
        <ReactPlayer
          ref={playerRef}
          url={project.sourceVideo}
          playing={project.isPlaying}
          volume={project.volume / 100}
          onProgress={handleProgress}
          width="100%"
          height="100%"
          style={{
            ...getFilterStyle(),
            maxWidth: '100%',
            maxHeight: '100%',
          }}
          progressInterval={50}
          controls={false}
        />
        
        {/* Video Overlays (rendered as DOM elements, interactive via canvas) */}
        {project.tracks
          .filter(t => t.type === 'video' && t.id !== 'video-1')
          .flatMap(track => track.clips)
          .filter(clip => 
            clip.enabled && 
            project.currentTime >= clip.start && 
            project.currentTime <= clip.end
          )
          .map(clip => {
            const position = clip.content?.position || { x: 70, y: 10, width: 25, height: 25 };
            
            return (
              <div
                key={`overlay-${clip.id}`}
                className="absolute pointer-events-none"
                style={{
                  top: `${position.y}%`,
                  left: `${position.x}%`,
                  width: `${position.width}%`,
                  height: `${position.height}%`,
                  zIndex: 5,
                }}
              >
                {clip.sourceUrl && (
                  <ReactPlayer
                    key={`video-${clip.id}`}
                    url={clip.sourceUrl}
                    playing={project.isPlaying}
                    volume={(clip.volume || 100) / 100}
                    width="100%"
                    height="100%"
                    style={{ objectFit: 'contain' }}
                    progressInterval={50}
                    controls={false}
                    className="rounded-lg shadow-lg"
                    onError={(error) => {
                      console.error('Video overlay failed to load:', error);
                    }}
                  />
                )}
              </div>
            );
          })
        }
        
        {/* Interactive Canvas Overlay - includes text, stickers, and interactive image overlays */}
        <div ref={canvasContainerRef} className="absolute top-0 left-0 w-full h-full" style={{ pointerEvents: 'auto' }} />
      </div>
    </div>
  );
};
