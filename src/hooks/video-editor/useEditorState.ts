import { useState, useRef, useCallback, useEffect } from "react";
import { PlayerRef } from "@remotion/player";
import { Overlay, AspectRatio, OverlayType } from "@/lib/video-editor/types";
import { FPS, VIDEO_WIDTH, VIDEO_HEIGHT } from "@/lib/video-editor/constants";

const ASPECT_RATIO_DIMENSIONS = {
  "16:9": { width: 1920, height: 1080 },
  "1:1": { width: 1080, height: 1080 },
  "4:5": { width: 1080, height: 1350 },
  "9:16": { width: 1080, height: 1920 },
};

export const useEditorState = () => {
  const [overlays, setOverlays] = useState<Overlay[]>([]);
  const [selectedOverlayId, setSelectedOverlayId] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("16:9");
  const [playerDimensions, setPlayerDimensions] = useState({ width: VIDEO_WIDTH, height: VIDEO_HEIGHT });
  const [history, setHistory] = useState<Overlay[][]>([[]]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const playerRef = useRef<PlayerRef>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const maxOverlayEnd = overlays.length > 0
    ? Math.max(...overlays.map((o) => o.from + o.durationInFrames))
    : 0;

  const durationInFrames = maxOverlayEnd > 0
    ? maxOverlayEnd + FPS * 2  // Add 2 seconds padding after last overlay
    : FPS * 5; // Default 5 seconds for empty timeline

  const durationInSeconds = durationInFrames / FPS;

  // Track current frame from player
  useEffect(() => {
    if (playerRef.current) {
      const handleFrameUpdate = () => {
        const frame = playerRef.current?.getCurrentFrame() || 0;
        setCurrentFrame(frame);
      };

      const interval = setInterval(handleFrameUpdate, 1000 / FPS);
      return () => clearInterval(interval);
    }
  }, []);

  const togglePlayPause = useCallback(() => {
    if (playerRef.current) {
      if (isPlaying) {
        playerRef.current.pause();
        setIsPlaying(false);
      } else {
        playerRef.current.play();
        setIsPlaying(true);
      }
    }
  }, [isPlaying]);

  const formatTime = useCallback((frame: number) => {
    const seconds = Math.floor(frame / FPS);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    const frames = Math.floor(frame % FPS);
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}:${frames.toString().padStart(2, "0")}`;
  }, []);

  const handleTimelineClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    const frame = Math.floor(percentage * durationInFrames);
    if (playerRef.current) {
      playerRef.current.seekTo(frame);
      setCurrentFrame(frame);
    }
  }, [durationInFrames]);

  const changeOverlay = useCallback((
    id: number,
    updater: Partial<Overlay> | ((overlay: Overlay) => Overlay)
  ) => {
    setOverlays((prev) => {
      return prev.map((overlay) => {
        if (overlay.id === id) {
          if (typeof updater === "function") {
            return updater(overlay);
          }
          return { ...overlay, ...updater } as Overlay;
        }
        return overlay;
      });
    });
  }, []);

  const handleOverlayChange = useCallback((updatedOverlay: Overlay) => {
    setOverlays((prev) =>
      prev.map((o) => (o.id === updatedOverlay.id ? updatedOverlay : o))
    );
  }, []);

  const addOverlay = useCallback((overlay: Overlay) => {
    setOverlays((prev) => [...prev, overlay]);
  }, []);

  const deleteOverlay = useCallback((id: number) => {
    setOverlays((prev) => prev.filter((o) => o.id !== id));
    setSelectedOverlayId(null);
  }, []);

  const duplicateOverlay = useCallback((id: number) => {
    const overlay = overlays.find((o) => o.id === id);
    if (overlay) {
      const newOverlay = {
        ...overlay,
        id: Date.now(),
        left: overlay.left + 20,
        top: overlay.top + 20,
      };
      addOverlay(newOverlay);
    }
  }, [overlays, addOverlay]);

  const splitOverlay = useCallback((id: number, splitPosition: number) => {
    const overlay = overlays.find((o) => o.id === id);
    if (overlay) {
      const elapsedFrames = splitPosition - overlay.from;
      
      const firstPart = {
        ...overlay,
        durationInFrames: elapsedFrames,
      };
      
      const secondPart: Overlay = {
        ...overlay,
        id: Date.now(),
        from: splitPosition,
        durationInFrames: overlay.durationInFrames - elapsedFrames,
      };
      
      // Update video/audio start times for second part
      if (overlay.type === OverlayType.VIDEO) {
        const videoStartOffset = overlay.videoStartTime;
        (secondPart as any).videoStartTime = videoStartOffset + (elapsedFrames / 30);
      }
      
      if (overlay.type === OverlayType.SOUND) {
        const audioStartOffset = overlay.startFromSound;
        (secondPart as any).startFromSound = audioStartOffset + (elapsedFrames / 30);
      }
      
      setOverlays((prev) =>
        prev.map((o) => (o.id === id ? firstPart : o)).concat([secondPart])
      );
    }
  }, [overlays]);

  const updatePlayerDimensions = useCallback((width: number, height: number) => {
    setPlayerDimensions({ width, height });
  }, []);

  const getAspectRatioDimensions = useCallback(() => {
    return ASPECT_RATIO_DIMENSIONS[aspectRatio];
  }, [aspectRatio]);

  const undo = useCallback(() => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      setOverlays(history[historyIndex - 1]);
    }
  }, [history, historyIndex]);

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
      setOverlays(history[historyIndex + 1]);
    }
  }, [history, historyIndex]);

  const resetOverlays = useCallback(() => {
    setOverlays([]);
    setSelectedOverlayId(null);
  }, []);

  return {
    overlays,
    setOverlays,
    selectedOverlayId,
    setSelectedOverlayId,
    isPlaying,
    setIsPlaying,
    currentFrame,
    setCurrentFrame,
    playbackRate,
    setPlaybackRate,
    aspectRatio,
    setAspectRatio,
    playerDimensions,
    updatePlayerDimensions,
    getAspectRatioDimensions,
    playerRef,
    containerRef,
    durationInFrames,
    durationInSeconds,
    togglePlayPause,
    formatTime,
    handleTimelineClick,
    changeOverlay,
    handleOverlayChange,
    addOverlay,
    deleteOverlay,
    duplicateOverlay,
    splitOverlay,
    undo,
    redo,
    canUndo: historyIndex > 0,
    canRedo: historyIndex < history.length - 1,
    resetOverlays,
  };
};
