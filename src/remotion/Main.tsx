import React, { useCallback } from "react";
import { AbsoluteFill } from "remotion";
import { Overlay } from "@/lib/video-editor/types";
import { Layer } from "./Layer";

export type MainProps = {
  readonly overlays: Overlay[];
  readonly setSelectedOverlayId: React.Dispatch<React.SetStateAction<number | null>>;
  readonly selectedOverlayId: number | null;
  readonly changeOverlay: (
    overlayId: number,
    updater: (overlay: Overlay) => Overlay
  ) => void;
  readonly durationInFrames: number;
  readonly fps: number;
  readonly width: number;
  readonly height: number;
};

const outer: React.CSSProperties = {
  backgroundColor: "#111827",
};

const layerContainer: React.CSSProperties = {
  overflow: "hidden",
  maxWidth: "3000px",
};

export const Main: React.FC<MainProps> = ({
  overlays,
  setSelectedOverlayId,
  selectedOverlayId,
}) => {
  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) {
        return;
      }
      
      // Check if we clicked on an overlay
      const target = e.target as HTMLElement;
      const overlayElement = target.closest('[data-overlay-id]');
      
      if (overlayElement) {
        const overlayId = parseInt(overlayElement.getAttribute('data-overlay-id') || '0');
        if (overlayId) {
          setSelectedOverlayId(overlayId);
          return;
        }
      }
      
      // Clicked on background
      setSelectedOverlayId(null);
    },
    [setSelectedOverlayId]
  );

  return (
    <AbsoluteFill style={outer} onPointerDown={onPointerDown}>
      <AbsoluteFill style={layerContainer}>
        {overlays.map((overlay) => {
          return (
            <div key={overlay.id} data-overlay-id={overlay.id}>
              <Layer
                overlay={overlay}
                selectedOverlayId={selectedOverlayId}
              />
            </div>
          );
        })}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
