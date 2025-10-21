import React, { createContext, useContext, useRef, useState, useCallback } from "react";

interface TimelineContextType {
  visibleRows: number;
  setVisibleRows: (rows: number) => void;
  timelineRef: React.RefObject<HTMLDivElement>;
  zoomScale: number;
  setZoomScale: (scale: number) => void;
  handleZoom: (delta: number) => void;
}

const TimelineContext = createContext<TimelineContextType | null>(null);

export const TimelineProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [visibleRows, setVisibleRows] = useState(5);
  const [zoomScale, setZoomScale] = useState(1);
  const timelineRef = useRef<HTMLDivElement>(null);

  const handleZoom = useCallback((delta: number) => {
    setZoomScale((prev) => Math.max(0.5, Math.min(3, prev + delta)));
  }, []);

  const value = {
    visibleRows,
    setVisibleRows,
    timelineRef,
    zoomScale,
    setZoomScale,
    handleZoom,
  };

  return <TimelineContext.Provider value={value}>{children}</TimelineContext.Provider>;
};

export const useTimeline = () => {
  const context = useContext(TimelineContext);
  if (!context) {
    throw new Error("useTimeline must be used within a TimelineProvider");
  }
  return context;
};
