import { useRef, useEffect, useState } from "react";
import ReactPlayer from "react-player";
import { Canvas as FabricCanvas, Text as FabricText } from "fabric";
import { VideoProject } from "@/pages/content-studio/VideoEditor";

interface VideoEditorCanvasProps {
  project: VideoProject;
  onTimeUpdate: (time: number) => void;
  onPlayingChange: (playing: boolean) => void;
}

export const VideoEditorCanvas = ({ project, onTimeUpdate, onPlayingChange }: VideoEditorCanvasProps) => {
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

  // Update text overlays based on current time
  useEffect(() => {
    if (!fabricCanvas) return;

    fabricCanvas.clear();

    // Add visible text layers
    project.textLayers.forEach((layer) => {
      if (project.currentTime >= layer.startTime && project.currentTime <= layer.endTime) {
        const text = new FabricText(layer.text, {
          left: (layer.position.x / 100) * fabricCanvas.width,
          top: (layer.position.y / 100) * fabricCanvas.height,
          fontSize: layer.style.fontSize,
          fontFamily: layer.style.fontFamily,
          fill: layer.style.color,
          backgroundColor: layer.style.backgroundColor,
          selectable: true,
        });

        fabricCanvas.add(text);
      }
    });

    fabricCanvas.renderAll();
  }, [fabricCanvas, project.textLayers, project.currentTime]);

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
    if (playedSeconds >= project.trimPoints.end) {
      onPlayingChange(false);
      playerRef.current?.seekTo(project.trimPoints.start);
    }
    onTimeUpdate(playedSeconds);
  };

  return (
    <div className="relative max-w-full max-h-full">
      <div className="relative bg-black rounded-lg overflow-hidden shadow-2xl">
        <ReactPlayer
          ref={playerRef}
          url={project.sourceVideo}
          playing={project.isPlaying}
          volume={project.volume / 100}
          onProgress={handleProgress}
          width="1280px"
          height="720px"
          style={getFilterStyle()}
          progressInterval={50}
        />
        
        {/* Overlay canvas */}
        <canvas
          ref={canvasRef}
          className="absolute top-0 left-0 pointer-events-none"
          style={{ mixBlendMode: 'normal' }}
        />
      </div>
    </div>
  );
};
