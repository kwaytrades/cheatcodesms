import { useEffect, useRef, MutableRefObject } from "react";
import { AVCanvas } from "@webav/av-canvas";
import { VideoClip } from "@/pages/content-studio/VideoEditor";

interface VideoEditorCanvasProps {
  format: { name: string; width: number; height: number };
  clips: VideoClip[];
  currentTime: number;
  canvasRef: MutableRefObject<AVCanvas | null>;
}

export const VideoEditorCanvas = ({ format, clips, currentTime, canvasRef }: VideoEditorCanvasProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const htmlCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!htmlCanvasRef.current) return;

    // Initialize AVCanvas with format dimensions
    const avCanvas = new AVCanvas(htmlCanvasRef.current, {
      width: format.width,
      height: format.height,
    } as any); // WebAV types may vary

    canvasRef.current = avCanvas;

    return () => {
      canvasRef.current = null;
    };
  }, [format, canvasRef]);

  // Calculate scale to fit canvas in container
  const scale = containerRef.current 
    ? Math.min(
        (containerRef.current.clientWidth - 32) / format.width,
        (containerRef.current.clientHeight - 32) / format.height,
        1
      )
    : 0.5;

  return (
    <div ref={containerRef} className="flex-1 flex items-center justify-center bg-muted/30 p-4 overflow-auto">
      <div className="relative" style={{ 
        width: format.width * scale, 
        height: format.height * scale 
      }}>
        <canvas
          ref={htmlCanvasRef}
          width={format.width}
          height={format.height}
          style={{
            width: '100%',
            height: '100%',
            backgroundColor: '#000',
            borderRadius: '8px',
            boxShadow: '0 10px 30px -10px rgba(0, 0, 0, 0.3)',
          }}
        />
        {clips.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center text-muted-foreground">
              <p className="text-lg font-medium">No clips added</p>
              <p className="text-sm">Import a video to get started</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
