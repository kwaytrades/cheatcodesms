import { useEffect } from "react";
import { useEditorContext } from "@/contexts/video-editor/EditorContext";

export const useKeyboardShortcuts = () => {
  const {
    selectedOverlayId,
    deleteOverlay,
    duplicateOverlay,
    splitOverlay,
    currentFrame,
    overlays,
    undo,
    redo,
  } = useEditorContext();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement).isContentEditable
      ) {
        return;
      }

      // Delete selected overlay
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedOverlayId) {
        e.preventDefault();
        deleteOverlay(selectedOverlayId);
      }

      // Duplicate selected overlay
      if (e.ctrlKey && e.key === 'd' && selectedOverlayId) {
        e.preventDefault();
        duplicateOverlay(selectedOverlayId);
      }

      // Split overlay at playhead
      if (e.key === 's' && selectedOverlayId) {
        const overlay = overlays.find(o => o.id === selectedOverlayId);
        if (overlay && currentFrame >= overlay.from && currentFrame < overlay.from + overlay.durationInFrames) {
          e.preventDefault();
          splitOverlay(selectedOverlayId, currentFrame);
        }
      }

      // Undo
      if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      }

      // Redo
      if (e.ctrlKey && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        redo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedOverlayId, currentFrame, overlays, deleteOverlay, duplicateOverlay, splitOverlay, undo, redo]);
};
