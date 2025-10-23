import React, { useEffect } from "react";
import { Player, PlayerRef } from "@remotion/player";
import { Main } from "@/remotion/Main";
import { useEditorContext } from "@/contexts/video-editor/EditorContext";
import { FPS } from "@/lib/video-editor/constants";
import { TransformControls } from "./TransformControls";

interface VideoPlayerProps {
  playerRef: React.RefObject<PlayerRef>;
  containerRef: React.RefObject<HTMLDivElement>;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({ playerRef, containerRef }) => {
  const {
    overlays,
    setSelectedOverlayId,
    changeOverlay,
    selectedOverlayId,
    aspectRatio,
    playerDimensions,
    updatePlayerDimensions,
    getAspectRatioDimensions,
    durationInFrames,
  } = useEditorContext();

  useEffect(() => {
    const handleDimensionUpdate = () => {
      const videoContainer = document.querySelector(".video-container");
      if (!videoContainer) return;

      const { width, height } = videoContainer.getBoundingClientRect();
      updatePlayerDimensions(width, height);
    };

    handleDimensionUpdate();
    window.addEventListener("resize", handleDimensionUpdate);

    return () => {
      window.removeEventListener("resize", handleDimensionUpdate);
    };
  }, [aspectRatio, updatePlayerDimensions]);

  const { width: compositionWidth, height: compositionHeight } =
    getAspectRatioDimensions();

  const selectedOverlay = overlays.find((o) => o.id === selectedOverlayId);

  return (
    <div className="w-full h-full overflow-hidden">
        <div className="z-0 video-container relative w-full h-full bg-slate-100/90 dark:bg-gray-800 bg-[linear-gradient(to_right,#80808015_1px,transparent_1px),linear-gradient(to_bottom,#80808015_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,#80808010_1px,transparent_1px),linear-gradient(to_bottom,#80808010_1px,transparent_1px)] bg-[size:16px_16px] shadow-lg">
          <div className="z-10 absolute inset-2 sm:inset-4 flex items-center justify-center">
            <div
              ref={containerRef}
              className="relative mx-2 sm:mx-0"
            style={{
              width: Math.min(playerDimensions.width, compositionWidth),
              height: Math.min(playerDimensions.height, compositionHeight),
              maxWidth: "100%",
              maxHeight: "100%",
            }}
          >
            <Player
              ref={playerRef}
              className="w-full h-full"
              component={Main}
              compositionWidth={compositionWidth}
              compositionHeight={compositionHeight}
              style={{
                width: "100%",
                height: "100%",
              }}
              durationInFrames={Math.round(durationInFrames)}
              fps={FPS}
              inputProps={{
                overlays,
                setSelectedOverlayId,
                changeOverlay,
                selectedOverlayId,
                durationInFrames,
                fps: FPS,
                width: compositionWidth,
                height: compositionHeight,
              }}
              errorFallback={() => <></>}
              overflowVisible
            />
            
            {/* Transform Controls for Selected Overlay */}
            {selectedOverlayId && selectedOverlay && selectedOverlay.type !== "sound" && (() => {
              const playerScale = Math.min(
                playerDimensions.width / compositionWidth,
                playerDimensions.height / compositionHeight
              );
              const playerRenderedWidth = compositionWidth * playerScale;
              const playerRenderedHeight = compositionHeight * playerScale;
              const playerOffsetX = (playerDimensions.width - playerRenderedWidth) / 2;
              const playerOffsetY = (playerDimensions.height - playerRenderedHeight) / 2;

              return (
                <TransformControls
                  overlay={selectedOverlay}
                  onChange={(updates) => changeOverlay(selectedOverlayId, updates)}
                  containerWidth={compositionWidth}
                  containerHeight={compositionHeight}
                  playerScale={playerScale}
                  playerOffsetX={playerOffsetX}
                  playerOffsetY={playerOffsetY}
                />
              );
            })()}
          </div>
        </div>
      </div>
    </div>
  );
};
