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
            durationInFrames: props.durationInFrames,
            width: props.width,
            height: props.height,
          };
        }}
        defaultProps={defaultProps}
      />
    </>
  );
};
