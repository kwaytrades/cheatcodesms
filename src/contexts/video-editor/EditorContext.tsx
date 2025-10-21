import React, { createContext, useContext, ReactNode } from "react";
import { Overlay, AspectRatio } from "@/lib/video-editor/types";

interface EditorContextProps {
  overlays: Overlay[];
  selectedOverlayId: number | null;
  setSelectedOverlayId: (id: number | null) => void;
  changeOverlay: (
    id: number,
    updater: Partial<Overlay> | ((overlay: Overlay) => Overlay)
  ) => void;
  setOverlays: (overlays: Overlay[]) => void;
  isPlaying: boolean;
  currentFrame: number;
  playerRef: React.RefObject<any>;
  playbackRate: number;
  setPlaybackRate: (rate: number) => void;
  togglePlayPause: () => void;
  formatTime: (frame: number) => string;
  handleTimelineClick: (e: React.MouseEvent<HTMLDivElement>) => void;
  handleOverlayChange: (updatedOverlay: Overlay) => void;
  addOverlay: (overlay: Overlay) => void;
  deleteOverlay: (id: number) => void;
  duplicateOverlay: (id: number) => void;
  splitOverlay: (id: number, splitPosition: number) => void;
  aspectRatio: AspectRatio;
  setAspectRatio: (ratio: AspectRatio) => void;
  playerDimensions: { width: number; height: number };
  updatePlayerDimensions: (width: number, height: number) => void;
  getAspectRatioDimensions: () => { width: number; height: number };
  durationInFrames: number;
  durationInSeconds: number;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  resetOverlays: () => void;
}

const EditorContext = createContext<EditorContextProps | undefined>(undefined);

export const EditorProvider: React.FC<{
  value: EditorContextProps;
  children: ReactNode;
}> = ({ value, children }) => {
  return (
    <EditorContext.Provider value={value}>{children}</EditorContext.Provider>
  );
};

export const useEditorContext = (): EditorContextProps => {
  const context = useContext(EditorContext);
  if (!context) {
    throw new Error("useEditorContext must be used within an EditorProvider");
  }
  return context;
};
