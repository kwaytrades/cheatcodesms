export interface VideoClip {
  id: string;
  type: 'video' | 'audio' | 'text' | 'image';
  url: string;
  startTime: number;
  duration: number;
  track: number;
  trimStart?: number;
  trimEnd?: number;
  originalDuration?: number;
  transform?: {
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: number;
    scale: number;
  };
  text?: string;
  textStyle?: {
    fontFamily: string;
    fontSize: number;
    color: string;
    fontWeight: string;
    textAlign: 'left' | 'center' | 'right';
  };
}
