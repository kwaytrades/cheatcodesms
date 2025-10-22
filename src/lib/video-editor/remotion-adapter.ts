import { Overlay } from "./types";

export interface RemotionCompositionData {
  overlays: Overlay[];
  durationInFrames: number;
  fps: number;
  width: number;
  height: number;
}

export interface ExportSettings {
  width: number;
  height: number;
  fps: number;
  codec: string;
  quality: number;
}

/**
 * Converts editor overlays to Remotion-compatible composition data
 */
export function prepareCompositionData(
  overlays: Overlay[],
  durationInFrames: number,
  fps: number,
  width: number,
  height: number
): RemotionCompositionData {
  return {
    overlays: overlays.map(overlay => ({
      ...overlay,
      // Ensure all paths are absolute URLs
      src: overlay.type === 'video' || overlay.type === 'image' || overlay.type === 'sound'
        ? overlay.src
        : undefined,
    })),
    durationInFrames,
    fps,
    width,
    height,
  };
}

/**
 * Prepares export settings for server-side rendering
 */
export function prepareExportSettings(
  aspectRatio: { width: number; height: number },
  quality: 'high' | 'medium' | 'low' = 'high'
): ExportSettings {
  const qualityMap = {
    high: 9,    // CRF 18
    medium: 7,  // CRF 23
    low: 5,     // CRF 28
  };

  return {
    width: aspectRatio.width,
    height: aspectRatio.height,
    fps: 30,
    codec: 'h264',
    quality: qualityMap[quality],
  };
}
