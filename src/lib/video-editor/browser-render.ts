import React from "react";
import ReactDOM from "react-dom/client";
import { Composition } from "remotion";
import { Main } from "@/remotion/Main";
import { Overlay } from "./types";

interface RenderOptions {
  overlays: Overlay[];
  durationInFrames: number;
  fps: number;
  width: number;
  height: number;
  onProgress?: (percent: number) => void;
}

export async function renderToBlob(options: RenderOptions): Promise<Blob> {
  const { overlays, durationInFrames, fps, width, height, onProgress } = options;

  return new Promise((resolve, reject) => {
    // Create hidden container
    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.top = '-9999px';
    container.style.left = '-9999px';
    container.style.width = `${width}px`;
    container.style.height = `${height}px`;
    document.body.appendChild(container);

    // Create canvas for rendering
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      reject(new Error('Failed to get canvas context'));
      return;
    }

    // Setup MediaRecorder
    const stream = canvas.captureStream(fps);
    const mediaRecorder = new MediaRecorder(stream, {
      mimeType: 'video/webm;codecs=vp9',
      videoBitsPerSecond: 5000000, // 5 Mbps
    });

    const chunks: Blob[] = [];
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    mediaRecorder.onstop = () => {
      document.body.removeChild(container);
      const blob = new Blob(chunks, { type: 'video/webm' });
      resolve(blob);
    };

    mediaRecorder.onerror = (e) => {
      document.body.removeChild(container);
      reject(new Error(`MediaRecorder error: ${e}`));
    };

    // Start recording
    mediaRecorder.start();

    // Render frames
    let currentFrame = 0;
    const frameDuration = 1000 / fps;

    const renderFrame = () => {
      if (currentFrame >= durationInFrames) {
        mediaRecorder.stop();
        return;
      }

      // Clear canvas
      ctx.fillStyle = '#111827';
      ctx.fillRect(0, 0, width, height);

      // Render each overlay for current frame
      overlays.forEach((overlay) => {
        if (currentFrame >= overlay.from && currentFrame < overlay.from + overlay.durationInFrames) {
          renderOverlay(ctx, overlay, width, height);
        }
      });

      currentFrame++;
      if (onProgress) {
        onProgress((currentFrame / durationInFrames) * 100);
      }

      setTimeout(renderFrame, frameDuration);
    };

    renderFrame();
  });
}

function renderOverlay(ctx: CanvasRenderingContext2D, overlay: Overlay, canvasWidth: number, canvasHeight: number) {
  ctx.save();

  // Apply transforms
  const centerX = overlay.left + overlay.width / 2;
  const centerY = overlay.top + overlay.height / 2;
  
  ctx.translate(centerX, centerY);
  if (overlay.rotation) {
    ctx.rotate((overlay.rotation * Math.PI) / 180);
  }
  ctx.translate(-centerX, -centerY);

  if (overlay.type === 'image' && overlay.src) {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = overlay.src;
    if (img.complete) {
      ctx.drawImage(img, overlay.left, overlay.top, overlay.width, overlay.height);
    }
  } else if (overlay.type === 'text') {
    const fontSize = overlay.styles?.fontSize || 24;
    const fontFamily = overlay.styles?.fontFamily || 'Arial';
    const color = overlay.styles?.color || '#ffffff';
    
    ctx.font = `${fontSize}px ${fontFamily}`;
    ctx.fillStyle = color;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    
    const text = overlay.content || '';
    ctx.fillText(text, overlay.left, overlay.top);
  }

  ctx.restore();
}
