import { PlayerRef } from "@remotion/player";
import { getFFmpeg } from "./ffmpeg-converter";
import { Overlay } from "./types";

interface RenderOptions {
  playerRef: React.RefObject<PlayerRef>;
  containerRef: React.RefObject<HTMLDivElement>;
  overlays: Overlay[];
  durationInFrames: number;
  fps: number;
  width: number;
  height: number;
  onProgress?: (progress: number) => void;
}

/**
 * Renders video client-side using Remotion Player frame capture + FFmpeg encoding
 */
export async function renderVideoToMP4(options: RenderOptions): Promise<Blob> {
  const { playerRef, containerRef, durationInFrames, fps, width, height, onProgress } = options;

  if (!playerRef.current) {
    throw new Error("Player ref not available");
  }

  console.log('[Client Render] Starting render:', { durationInFrames, fps, width, height });

  // Pause player during capture
  playerRef.current.pause();

  // Load FFmpeg
  onProgress?.(5);
  console.log('[Client Render] Loading FFmpeg...');
  const ffmpeg = await getFFmpeg();

  // Capture all frames
  const frames: Uint8Array[] = [];
  const totalFrames = Math.ceil(durationInFrames);
  
  console.log('[Client Render] Capturing', totalFrames, 'frames...');
  
  for (let frame = 0; frame < totalFrames; frame++) {
    // Seek to frame
    playerRef.current.seekTo(frame);
    
    // Wait for frame to render
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // Get the player's canvas
    const canvas = await capturePlayerCanvas(playerRef, containerRef, width, height);
    
    // Convert to PNG data
    const blob = await canvasToBlob(canvas);
    const arrayBuffer = await blob.arrayBuffer();
    frames.push(new Uint8Array(arrayBuffer));
    
    // Update progress (5-80% for frame capture)
    const captureProgress = 5 + (frame / totalFrames) * 75;
    onProgress?.(captureProgress);
    
    if (frame % 10 === 0) {
      console.log(`[Client Render] Captured frame ${frame}/${totalFrames}`);
    }
  }

  console.log('[Client Render] All frames captured, encoding with FFmpeg...');
  onProgress?.(80);

  // Write frames to FFmpeg virtual filesystem
  for (let i = 0; i < frames.length; i++) {
    const filename = `frame${i.toString().padStart(5, '0')}.png`;
    await ffmpeg.writeFile(filename, frames[i]);
  }

  onProgress?.(85);

  // Encode video with FFmpeg
  console.log('[Client Render] Running FFmpeg encoding...');
  await ffmpeg.exec([
    // Input settings
    '-framerate', fps.toString(),
    '-start_number', '0',
    '-i', 'frame%05d.png',
    
    // Explicitly set number of frames to encode
    '-frames:v', totalFrames.toString(),
    
    // Generate proper timestamps
    '-fflags', '+genpts',
    
    // Output framerate (critical for duration)
    '-r', fps.toString(),
    
    // Video sync method - prevent frame duplication
    '-vsync', 'cfr',
    
    // Video encoding
    '-c:v', 'libx264',
    '-profile:v', 'baseline',
    '-level', '3.0',
    '-preset', 'medium',
    '-crf', '23',
    '-pix_fmt', 'yuv420p',
    
    // Standard MPEG timescale
    '-video_track_timescale', '90000',
    
    // FIXED: Correct movflags syntax
    '-movflags', 'faststart+frag_keyframe',
    
    // Explicitly set duration in metadata
    '-metadata', `duration=${(totalFrames / fps).toFixed(3)}`,
    
    'output.mp4'
  ]);

  onProgress?.(95);

  // Read output
  const mp4Data = await ffmpeg.readFile('output.mp4');
  const mp4Blob = new Blob([new Uint8Array(mp4Data as Uint8Array)], { type: 'video/mp4' });

  console.log('[Client Render] Render complete, output size:', mp4Blob.size, 'bytes');

  // Cleanup
  for (let i = 0; i < frames.length; i++) {
    const filename = `frame${i.toString().padStart(5, '0')}.png`;
    await ffmpeg.deleteFile(filename);
  }
  await ffmpeg.deleteFile('output.mp4');

  onProgress?.(100);

  return mp4Blob;
}

/**
 * Captures the current frame from Remotion Player's canvas
 */
async function capturePlayerCanvas(
  playerRef: React.RefObject<PlayerRef>,
  containerRef: React.RefObject<HTMLDivElement>,
  width: number,
  height: number
): Promise<HTMLCanvasElement> {
  // Find the Remotion canvas element from the container ref
  if (!containerRef.current) {
    throw new Error("Could not find player container");
  }

  // Find canvas in player container
  const sourceCanvas = containerRef.current.querySelector('canvas');
  if (!sourceCanvas) {
    throw new Error("Could not find player canvas");
  }

  // Create output canvas with correct dimensions
  const outputCanvas = document.createElement('canvas');
  outputCanvas.width = width;
  outputCanvas.height = height;
  const ctx = outputCanvas.getContext('2d');
  
  if (!ctx) {
    throw new Error("Could not get canvas context");
  }

  // Draw current frame
  ctx.drawImage(sourceCanvas, 0, 0, width, height);

  return outputCanvas;
}

/**
 * Converts canvas to PNG blob
 */
function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error("Failed to convert canvas to blob"));
      }
    }, 'image/png');
  });
}
