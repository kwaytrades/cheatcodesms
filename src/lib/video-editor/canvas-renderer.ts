import { Overlay } from "./types";

export interface RenderFrame {
  frameNumber: number;
  timestamp: number;
}

export class CanvasRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private loadedAssets: Map<string, HTMLImageElement | HTMLVideoElement> = new Map();

  constructor(width: number, height: number) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = width;
    this.canvas.height = height;
    const ctx = this.canvas.getContext('2d', { 
      alpha: false,
      desynchronized: true 
    });
    if (!ctx) throw new Error('Failed to get canvas context');
    this.ctx = ctx;
  }

  async preloadAssets(overlays: Overlay[]): Promise<void> {
    const loadPromises: Promise<void>[] = [];

    for (const overlay of overlays) {
      if (overlay.type === 'image' && overlay.src) {
        loadPromises.push(this.loadImage(overlay.src));
      } else if (overlay.type === 'video' && overlay.src) {
        loadPromises.push(this.loadVideo(overlay.src));
      }
    }

    await Promise.all(loadPromises);
  }

  private async loadImage(src: string): Promise<void> {
    if (this.loadedAssets.has(src)) return;

    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        this.loadedAssets.set(src, img);
        resolve();
      };
      img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
      img.src = src;
    });
  }

  private async loadVideo(src: string): Promise<void> {
    if (this.loadedAssets.has(src)) return;

    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.crossOrigin = 'anonymous';
      video.preload = 'auto';
      video.onloadeddata = () => {
        this.loadedAssets.set(src, video);
        resolve();
      };
      video.onerror = () => reject(new Error(`Failed to load video: ${src}`));
      video.src = src;
    });
  }

  async renderFrame(overlays: Overlay[], frameNumber: number, fps: number): Promise<void> {
    // Clear canvas with black background
    this.ctx.fillStyle = '#000000';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Sort overlays by z-index (from styles)
    const sortedOverlays = [...overlays].sort((a, b) => {
      const aZIndex = 'styles' in a ? (a.styles.zIndex || 0) : 0;
      const bZIndex = 'styles' in b ? (b.styles.zIndex || 0) : 0;
      return aZIndex - bZIndex;
    });

    for (const overlay of sortedOverlays) {
      // Check if overlay is visible at this frame
      if (frameNumber < overlay.from || frameNumber >= overlay.from + overlay.durationInFrames) {
        continue;
      }

      const overlayFrame = frameNumber - overlay.from;

      try {
        switch (overlay.type) {
          case 'text':
            this.renderText(overlay, overlayFrame, fps);
            break;
          case 'image':
            this.renderImage(overlay);
            break;
          case 'video':
            await this.renderVideo(overlay, overlayFrame, fps);
            break;
        }
      } catch (error) {
        console.error(`Error rendering overlay ${overlay.id}:`, error);
      }
    }
  }

  private renderText(overlay: Overlay, frame: number, fps: number): void {
    if (overlay.type !== 'text') return;

    this.ctx.save();

    // Apply position and size
    const x = overlay.left || 0;
    const y = overlay.top || 0;
    const width = overlay.width || this.canvas.width;
    const height = overlay.height || 100;

    // Set text properties from styles
    const fontSize = parseInt(overlay.styles.fontSize) || 48;
    const fontFamily = overlay.styles.fontFamily || 'Arial';
    this.ctx.font = `${fontSize}px ${fontFamily}`;
    this.ctx.fillStyle = overlay.styles.color || '#ffffff';
    this.ctx.textAlign = (overlay.styles.textAlign as CanvasTextAlign) || 'center';
    this.ctx.textBaseline = 'middle';

    // Apply opacity from styles
    this.ctx.globalAlpha = overlay.styles.opacity ?? 1;

    // Draw text
    const text = overlay.content || '';
    this.ctx.fillText(text, x + width / 2, y + height / 2);

    this.ctx.restore();
  }

  private renderImage(overlay: Overlay): void {
    if (overlay.type !== 'image' || !overlay.src) return;

    const img = this.loadedAssets.get(overlay.src) as HTMLImageElement;
    if (!img || !img.complete) return;

    this.ctx.save();

    const x = overlay.left || 0;
    const y = overlay.top || 0;
    const width = overlay.width || img.naturalWidth;
    const height = overlay.height || img.naturalHeight;

    this.ctx.globalAlpha = overlay.styles.opacity ?? 1;
    this.ctx.drawImage(img, x, y, width, height);

    this.ctx.restore();
  }

  private async renderVideo(overlay: Overlay, frame: number, fps: number): Promise<void> {
    if (overlay.type !== 'video' || !overlay.src) return;

    const video = this.loadedAssets.get(overlay.src) as HTMLVideoElement;
    if (!video) return;

    // Calculate video time for this frame
    const videoTime = frame / fps;
    
    // Seek video to correct time if needed
    if (Math.abs(video.currentTime - videoTime) > 0.1) {
      video.currentTime = videoTime;
      await new Promise(resolve => {
        video.onseeked = () => resolve(null);
      });
    }

    this.ctx.save();

    const x = overlay.left || 0;
    const y = overlay.top || 0;
    const width = overlay.width || video.videoWidth;
    const height = overlay.height || video.videoHeight;

    this.ctx.globalAlpha = overlay.styles.opacity ?? 1;
    this.ctx.drawImage(video, x, y, width, height);

    this.ctx.restore();
  }

  getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }

  destroy(): void {
    this.loadedAssets.clear();
  }
}
