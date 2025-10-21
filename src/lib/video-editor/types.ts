export enum OverlayType {
  TEXT = "text",
  IMAGE = "image",
  VIDEO = "video",
  SOUND = "sound",
  CAPTION = "caption",
  STICKER = "sticker",
}

type BaseOverlay = {
  id: number;
  durationInFrames: number;
  from: number;
  height: number;
  row: number;
  left: number;
  top: number;
  width: number;
  isDragging: boolean;
  rotation: number;
  type: OverlayType;
};

type BaseStyles = {
  opacity?: number;
  zIndex?: number;
  transform?: string;
};

type AnimationConfig = {
  enter?: string;
  exit?: string;
};

export type TextOverlay = BaseOverlay & {
  type: OverlayType.TEXT;
  content: string;
  styles: BaseStyles & {
    fontSize: string;
    fontWeight: string;
    color: string;
    backgroundColor: string;
    fontFamily: string;
    fontStyle: string;
    textDecoration: string;
    lineHeight?: string;
    letterSpacing?: string;
    textAlign?: "left" | "center" | "right";
    textShadow?: string;
    padding?: string;
    paddingBackgroundColor?: string;
    borderRadius?: string;
    boxShadow?: string;
    background?: string;
    animation?: AnimationConfig;
  };
};

export type VideoOverlay = BaseOverlay & {
  type: OverlayType.VIDEO;
  content: string;
  src: string;
  videoStartTime: number;
  speed?: number;
  styles: BaseStyles & {
    objectFit?: "contain" | "cover" | "fill" | "none" | "scale-down";
    objectPosition?: string;
    volume?: number;
    borderRadius?: string;
    filter?: string;
    boxShadow?: string;
    border?: string;
    padding?: string;
    paddingBackgroundColor?: string;
    animation?: AnimationConfig;
  };
};

export type ImageOverlay = BaseOverlay & {
  type: OverlayType.IMAGE;
  src: string;
  content?: string;
  styles: BaseStyles & {
    filter?: string;
    borderRadius?: string;
    objectFit?: "contain" | "cover" | "fill" | "none" | "scale-down";
    objectPosition?: string;
    boxShadow?: string;
    border?: string;
    padding?: string;
    paddingBackgroundColor?: string;
    animation?: AnimationConfig;
  };
};

export type SoundOverlay = BaseOverlay & {
  type: OverlayType.SOUND;
  content: string;
  src: string;
  startFromSound: number;
  styles: BaseStyles & {
    volume?: number;
  };
};

export type Overlay = TextOverlay | VideoOverlay | ImageOverlay | SoundOverlay;

export type AspectRatio = "16:9" | "1:1" | "4:5" | "9:16";

export interface ExportSettings {
  resolution: "1080p" | "4K" | "720p";
  quality: "high" | "medium" | "low";
  preset: "slow" | "medium" | "fast";
}

export const RESOLUTION_PRESETS = {
  "720p": { width: 1280, height: 720, label: "HD (720p)" },
  "1080p": { width: 1920, height: 1080, label: "Full HD (1080p)" },
  "4K": { width: 3840, height: 2160, label: "4K Ultra HD" },
} as const;

export const QUALITY_PRESETS = {
  high: { crf: 18, label: "High Quality", description: "Best quality, larger file" },
  medium: { crf: 23, label: "Medium Quality", description: "Balanced quality and size" },
  low: { crf: 28, label: "Low Quality", description: "Smaller file, lower quality" },
} as const;

export const ENCODING_PRESETS = {
  slow: { label: "Slow", description: "Best compression, takes longer" },
  medium: { label: "Medium", description: "Balanced speed and compression" },
  fast: { label: "Fast", description: "Quick export, larger file" },
} as const;
