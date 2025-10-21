import React from "react";
import { Audio } from "remotion";
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
      return (
        <div style={{ ...commonStyle, ...getStylesWithoutAnimation(overlay.styles) }}>
          <video
            src={overlay.src}
            style={{
              width: "100%",
              height: "100%",
              objectFit: overlay.styles.objectFit || "cover",
              filter: overlay.styles.filter,
              borderRadius: overlay.styles.borderRadius,
            }}
            muted
            playsInline
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
      return <Audio src={overlay.src} volume={overlay.styles.volume || 1} />;

    default:
      return null;
  }
};
