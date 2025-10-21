import { useState, useCallback } from 'react';
import { Overlay, ExportSettings } from '@/lib/video-editor/types';
import { toast } from 'sonner';

export const useClientVideoExport = () => {
  const [progress, setProgress] = useState(0);
  const [isExporting, setIsExporting] = useState(false);

  const exportVideo = useCallback(async (
    overlays: Overlay[],
    durationInFrames: number,
    fps: number,
    width: number,
    height: number,
    settings: ExportSettings,
    onProgress?: (progress: number) => void
  ) => {
    try {
      setIsExporting(true);
      setProgress(0);
      onProgress?.(0);
      
      console.log('Starting client-side video export:', { width, height, fps, durationInFrames });
      toast.info('Loading media assets...');

      // Pre-load all media assets
      const videoAssets = new Map<string, HTMLVideoElement>();
      const imageAssets = new Map<string, HTMLImageElement>();
      
      const videoSources = new Set<string>();
      const imageSources = new Set<string>();
      
      overlays.forEach(overlay => {
        if (overlay.type === 'video' && overlay.src) {
          videoSources.add(overlay.src);
        } else if (overlay.type === 'image' && overlay.src) {
          imageSources.add(overlay.src);
        }
      });
      
      // Load all videos
      const videoLoads = Array.from(videoSources).map(async (src) => {
        const video = document.createElement('video');
        video.src = src;
        video.preload = 'auto';
        await new Promise((resolve, reject) => {
          video.onloadeddata = resolve;
          video.onerror = reject;
        });
        videoAssets.set(src, video);
      });
      
      // Load all images
      const imageLoads = Array.from(imageSources).map(async (src) => {
        const img = new Image();
        img.src = src;
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
        });
        imageAssets.set(src, img);
      });
      
      await Promise.all([...videoLoads, ...imageLoads]);
      toast.info('Rendering video...');

      // Create canvas for rendering
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        throw new Error('Failed to create canvas context');
      }

      // Set up MediaRecorder
      const stream = canvas.captureStream(fps);
      const mimeType = 'video/webm;codecs=vp9';
      
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        throw new Error('WebM VP9 codec not supported in this browser');
      }

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: settings.quality === 'high' ? 8000000 : 
                           settings.quality === 'medium' ? 4000000 : 2000000
      });

      const chunks: Blob[] = [];
      
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      // Start recording with timeslice
      mediaRecorder.start(100);
      
      const totalFrames = durationInFrames;
      
      // Render each frame
      for (let frame = 0; frame < totalFrames; frame++) {
        // Clear canvas
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, width, height);
        
        // Render overlays for this frame
        for (const overlay of overlays) {
          if (frame >= overlay.from && frame < (overlay.from + overlay.durationInFrames)) {
            renderOverlaySync(ctx, overlay, frame - overlay.from, fps, videoAssets, imageAssets);
          }
        }
        
        // Update progress
        const progressPercent = Math.round((frame / totalFrames) * 100);
        setProgress(progressPercent);
        onProgress?.(progressPercent);
      }
      
      // Stop recording
      mediaRecorder.stop();
      
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Recording timeout')), 5000);
        
        mediaRecorder.onstop = () => {
          clearTimeout(timeout);
          const blob = new Blob(chunks, { type: mimeType });
          
          // Download the video
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `video-export-${Date.now()}.webm`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          
          toast.success('Video exported and downloaded!');
          setProgress(100);
          resolve();
        };
      });
      
      setIsExporting(false);
      
    } catch (error: any) {
      console.error('Export error:', error);
      toast.error(`Export failed: ${error.message}`);
      setIsExporting(false);
      setProgress(0);
      onProgress?.(0);
      throw error;
    }
  }, []);

  const cancelExport = useCallback(() => {
    setIsExporting(false);
    setProgress(0);
    toast.info('Export cancelled');
  }, []);

  return {
    exportVideo,
    cancelExport,
    progress,
    isExporting
  };
};

function renderOverlaySync(
  ctx: CanvasRenderingContext2D,
  overlay: Overlay,
  frameIndex: number,
  fps: number,
  videoAssets: Map<string, HTMLVideoElement>,
  imageAssets: Map<string, HTMLImageElement>
) {
  try {
    if (overlay.type === 'video' && overlay.src) {
      const video = videoAssets.get(overlay.src);
      if (video) {
        video.currentTime = frameIndex / fps + (overlay.videoStartTime || 0);
        
        ctx.save();
        ctx.translate(overlay.left, overlay.top);
        ctx.rotate((overlay.rotation || 0) * Math.PI / 180);
        ctx.drawImage(video, 0, 0, overlay.width, overlay.height);
        ctx.restore();
      }
    } else if (overlay.type === 'image' && overlay.src) {
      const img = imageAssets.get(overlay.src);
      if (img) {
        ctx.save();
        ctx.translate(overlay.left, overlay.top);
        ctx.rotate((overlay.rotation || 0) * Math.PI / 180);
        ctx.drawImage(img, 0, 0, overlay.width, overlay.height);
        ctx.restore();
      }
    } else if (overlay.type === 'text' && overlay.content) {
      ctx.save();
      ctx.translate(overlay.left, overlay.top);
      ctx.rotate((overlay.rotation || 0) * Math.PI / 180);
      
      const fontSize = parseInt(overlay.styles?.fontSize || '24px');
      const fontFamily = overlay.styles?.fontFamily || 'Arial';
      ctx.font = `${fontSize}px ${fontFamily}`;
      ctx.fillStyle = overlay.styles?.color || '#ffffff';
      ctx.textAlign = (overlay.styles?.textAlign as CanvasTextAlign) || 'left';
      ctx.fillText(overlay.content, 0, 0);
      
      ctx.restore();
    }
  } catch (error) {
    console.error('Error rendering overlay:', error);
  }
}
