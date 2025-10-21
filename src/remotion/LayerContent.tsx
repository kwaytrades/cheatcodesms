import React from "react";
import { Audio, Video } from "remotion";
import { Overlay, OverlayType } from "@/lib/video-editor/types";

interface LayerContentProps {
  overlay: Overlay;
}

export const LayerContent: React.FC<LayerContentProps> = ({ overlay }) => {
  const commonStyle: React.CSSProperties = {
    width: "100%",
    height: "100%",
  };

  // Filter out animation config from styles
  const getStylesWithoutAnimation = (styles: any): React.CSSProperties => {
    const { animation, ...rest } = styles || {};
    return rest as React.CSSProperties;
  };

  switch (overlay.type) {
    case OverlayType.VIDEO:
      const videoStartFrame = Math.round(overlay.videoStartTime * 30);
      const videoEndFrame = videoStartFrame + overlay.durationInFrames;
      return (
        <div style={{ ...commonStyle, ...getStylesWithoutAnimation(overlay.styles) }}>
          <Video
            src={overlay.src}
            startFrom={videoStartFrame}
            endAt={videoEndFrame}
            style={{
              width: "100%",
              height: "100%",
              objectFit: overlay.styles.objectFit || "cover",
              filter: overlay.styles.filter,
              borderRadius: overlay.styles.borderRadius,
            }}
          />
        </div>
      );

    case OverlayType.TEXT:
      const textStyles = getStylesWithoutAnimation(overlay.styles);
      return (
        <div
          style={{
            ...commonStyle,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: overlay.styles.backgroundColor,
          }}
        >
          <span style={{
            ...textStyles,
            textAlign: overlay.styles.textAlign || "center",
          } as React.CSSProperties}>
            {overlay.content}
          </span>
        </div>
      );

    case OverlayType.IMAGE:
      return (
        <div style={{ ...commonStyle, ...getStylesWithoutAnimation(overlay.styles) }}>
          <img
            src={overlay.src}
            style={{
              width: "100%",
              height: "100%",
              objectFit: overlay.styles.objectFit || "contain",
              filter: overlay.styles.filter,
              borderRadius: overlay.styles.borderRadius,
            }}
            alt=""
          />
        </div>
      );

    case OverlayType.SOUND:
      const audioStartFrame = Math.round(overlay.startFromSound * 30);
      const audioEndFrame = audioStartFrame + overlay.durationInFrames;
      return (
        <Audio
          src={overlay.src}
          startFrom={audioStartFrame}
          endAt={audioEndFrame}
          volume={overlay.styles.volume || 1}
        />
      );

    default:
      return null;
  }
};
