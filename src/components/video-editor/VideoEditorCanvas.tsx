import { useRef, useEffect, useState } from "react";
import ReactPlayer from "react-player";
import { Canvas as FabricCanvas, Text as FabricText } from "fabric";
import { VideoProject } from "@/pages/content-studio/VideoEditor";
import { Button } from "@/components/ui/button";

interface VideoEditorCanvasProps {
  project: VideoProject;
  selectedClipId: string | null;
  onTimeUpdate: (time: number) => void;
  onPlayingChange: (playing: boolean) => void;
}

export const VideoEditorCanvas = ({ project, selectedClipId, onTimeUpdate, onPlayingChange }: VideoEditorCanvasProps) => {
  const playerRef = useRef<ReactPlayer>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [fabricCanvas, setFabricCanvas] = useState<FabricCanvas | null>(null);

  // Initialize fabric canvas for overlays
  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = new FabricCanvas(canvasRef.current, {
      width: 1280,
      height: 720,
      backgroundColor: 'transparent',
      selection: false,
    });

    setFabricCanvas(canvas);

    return () => {
      canvas.dispose();
    };
  }, []);

  // Update text overlays and stickers based on current time
  useEffect(() => {
    if (!fabricCanvas) return;
    
    // Check if canvas is ready with a valid context
    try {
      const ctx = fabricCanvas.getContext();
      if (!ctx) return;
    } catch (error) {
      console.error('Canvas context not available:', error);
      return;
    }

    // Use requestAnimationFrame to batch updates
    requestAnimationFrame(() => {
      try {
        fabricCanvas.clear();

        // Get all text clips from text track
        const textTrack = project.tracks.find(t => t.type === 'text');
        if (textTrack) {
          textTrack.clips
            .filter(clip => clip.enabled && project.currentTime >= clip.start && project.currentTime <= clip.end)
            .forEach((clip) => {
              if (clip.content?.text) {
                try {
                  const text = new FabricText(clip.content.text, {
                    left: (clip.content.position?.x || 50) * (fabricCanvas.width! / 100),
                    top: (clip.content.position?.y || 50) * (fabricCanvas.height! / 100),
                    fontSize: clip.content.fontSize || 32,
                    fontFamily: clip.content.fontFamily || 'Arial',
                    fill: clip.content.color || '#ffffff',
                    selectable: false,
                  });

                  fabricCanvas.add(text);
                } catch (err) {
                  console.error('Error adding text:', err);
                }
              }
            });
        }

        // Get all sticker clips from sticker track
        const stickerTrack = project.tracks.find(t => t.type === 'sticker');
        if (stickerTrack) {
          stickerTrack.clips
            .filter(clip => clip.enabled && project.currentTime >= clip.start && project.currentTime <= clip.end)
            .forEach((clip) => {
              if (clip.content?.emoji) {
                try {
                  const emoji = new FabricText(clip.content.emoji, {
                    left: (clip.content.position?.x || 50) * (fabricCanvas.width! / 100),
                    top: (clip.content.position?.y || 50) * (fabricCanvas.height! / 100),
                    fontSize: 60 * ((clip.content.scale || 100) / 100),
                    angle: clip.content.rotation || 0,
                    selectable: false,
                  });

                  fabricCanvas.add(emoji);
                } catch (err) {
                  console.error('Error adding sticker:', err);
                }
              }
            });
        }

        fabricCanvas.renderAll();
      } catch (error) {
        console.error('Error updating canvas:', error);
      }
    });
  }, [fabricCanvas, project.tracks, project.currentTime]);

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
        
        {/* Image and Video Overlays */}
        {project.tracks
          .find(t => t.id === 'video-2')
          ?.clips.filter(clip => 
            clip.enabled && 
            project.currentTime >= clip.start && 
            project.currentTime <= clip.end
          )
          .map(clip => {
            const position = clip.content?.position || { x: 70, y: 10, width: 25, height: 25 };
            
            return (
              <div
                key={clip.id}
                className="absolute"
                style={{
                  top: `${position.y}%`,
                  left: `${position.x}%`,
                  width: `${position.width}%`,
                  height: `${position.height}%`,
                  zIndex: 5,
                }}
              >
                {clip.type === 'image' && clip.sourceUrl && (
                  <img 
                    src={clip.sourceUrl} 
                    alt="Overlay" 
                    className="w-full h-full object-contain rounded-lg shadow-lg"
                  />
                )}
                {clip.type === 'video' && clip.sourceUrl && (
                  <ReactPlayer
                    url={clip.sourceUrl}
                    playing={project.isPlaying}
                    volume={(clip.volume || 100) / 100}
                    width="100%"
                    height="100%"
                    style={{ objectFit: 'contain' }}
                    progressInterval={50}
                    controls={false}
                    className="rounded-lg shadow-lg"
                  />
                )}
              </div>
            );
          })
        }
        
        {/* Text and Sticker Canvas Overlay */}
        <canvas
          ref={canvasRef}
          className="absolute top-0 left-0 pointer-events-none w-full h-full"
          style={{ mixBlendMode: 'normal', zIndex: 10 }}
        />
      </div>
    </div>
  );
};
