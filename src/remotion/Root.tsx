import { Composition } from "remotion";
import { Main } from "./Main";
import { COMP_NAME, DURATION_IN_FRAMES, FPS, VIDEO_WIDTH, VIDEO_HEIGHT } from "@/lib/video-editor/constants";

export const RemotionRoot: React.FC = () => {
  const defaultProps: any = {
    overlays: [],
    durationInFrames: DURATION_IN_FRAMES,
    fps: FPS,
    width: VIDEO_WIDTH,
    height: VIDEO_HEIGHT,
    setSelectedOverlayId: () => {},
    selectedOverlayId: null,
    changeOverlay: () => {},
  };

  return (
    <>
      <Composition
        id={COMP_NAME}
        component={Main}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={VIDEO_WIDTH}
        height={VIDEO_HEIGHT}
        calculateMetadata={async ({ props }) => {
          return {
            durationInFrames: props.durationInFrames || DURATION_IN_FRAMES,
            width: props.width || VIDEO_WIDTH,
            height: props.height || VIDEO_HEIGHT,
            fps: props.fps || FPS,
          };
        }}
        defaultProps={defaultProps}
      />
    </>
  );
};

// This is required for @remotion/bundler to work
export default RemotionRoot;
