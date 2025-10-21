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
  videoStartTime?: number;
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
  startFromSound?: number;
  styles: BaseStyles & {
    volume?: number;
  };
};

export type Overlay = TextOverlay | VideoOverlay | ImageOverlay | SoundOverlay;

export type AspectRatio = "16:9" | "1:1" | "4:5" | "9:16";
