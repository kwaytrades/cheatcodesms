export const FPS = 30;
export const COMP_NAME = "VideoEditorComposition";
export const DURATION_IN_FRAMES = 900; // 30 seconds default
export const VIDEO_WIDTH = 1920;
export const VIDEO_HEIGHT = 1080;
export const INITIAL_ROWS = 5;
export const MAX_ROWS = 8;
export const ROW_HEIGHT = 48;
export const ZOOM_CONSTRAINTS = {
  min: 0.2,
  max: 10,
  step: 0.1,
  default: 1,
  zoomStep: 0.15,
  wheelStep: 0.3,
  transitionDuration: 100,
  easing: "cubic-bezier(0.4, 0.0, 0.2, 1)",
};
export const SNAPPING_CONFIG = {
  thresholdFrames: 1,
  enableVerticalSnapping: true,
};
export const DISABLE_MOBILE_LAYOUT = false;
export const AUTO_SAVE_INTERVAL = 10000;
export const SHOW_LOADING_PROJECT_ALERT = false;
