import React, { useState } from "react";
import { EditorProvider } from "@/contexts/video-editor/EditorContext";
import { SidebarProvider } from "@/contexts/video-editor/SidebarContext";
import { TimelineProvider } from "@/contexts/video-editor/TimelineContext";
import { SidebarProvider as UISidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { useEditorState } from "@/hooks/video-editor/useEditorState";
import { VideoPlayer } from "./VideoPlayer";
import { EditorSidebar } from "./sidebar/EditorSidebar";
import { AdvancedTimeline } from "./timeline/AdvancedTimeline";
import { ExportDialog } from "./export/ExportDialog";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward,
  Download,
  ZoomIn,
  ZoomOut,
  Scissors,
  Trash2
} from "lucide-react";
import { useTimeline } from "@/contexts/video-editor/TimelineContext";
import { useKeyboardShortcuts } from "@/hooks/video-editor/useKeyboardShortcuts";

const EditorControls: React.FC = () => {
  const editorState = useEditorState();
  const { zoomScale, handleZoom } = useTimeline();
  const [exportDialogOpen, setExportDialogOpen] = useState(false);

  // Enable keyboard shortcuts
  useKeyboardShortcuts();

  const handleExport = async () => {
    console.log("Exporting video...");
    // TODO: Implement actual export using Remotion renderer
    await new Promise(resolve => setTimeout(resolve, 2000));
  };

  const skipBackward = () => {
    if (editorState.playerRef.current) {
      editorState.playerRef.current.seekTo(Math.max(0, editorState.currentFrame - 30));
    }
  };

  const skipForward = () => {
    if (editorState.playerRef.current) {
      editorState.playerRef.current.seekTo(
        Math.min(editorState.durationInFrames, editorState.currentFrame + 30)
      );
    }
  };

  const handleSplit = () => {
    if (editorState.selectedOverlayId) {
      const overlay = editorState.overlays.find(o => o.id === editorState.selectedOverlayId);
      if (overlay && editorState.currentFrame >= overlay.from && editorState.currentFrame < overlay.from + overlay.durationInFrames) {
        editorState.splitOverlay(editorState.selectedOverlayId, editorState.currentFrame);
      }
    }
  };

  const canSplitAtPlayhead = () => {
    if (!editorState.selectedOverlayId) return false;
    const overlay = editorState.overlays.find(o => o.id === editorState.selectedOverlayId);
    return overlay ? editorState.currentFrame >= overlay.from && editorState.currentFrame < overlay.from + overlay.durationInFrames : false;
  };

  return (
    <>
      <Card className="p-4 space-y-4">
        {/* Playback Controls */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={skipBackward}
            >
              <SkipBack className="h-4 w-4" />
            </Button>
            
            <Button
              variant="outline"
              size="icon"
              onClick={editorState.togglePlayPause}
            >
              {editorState.isPlaying ? (
                <Pause className="h-4 w-4" />
              ) : (
                <Play className="h-4 w-4" />
              )}
            </Button>

            <Button
              variant="outline"
              size="icon"
              onClick={skipForward}
            >
              <SkipForward className="h-4 w-4" />
            </Button>
          </div>

          {/* Split Button */}
          <Button
            variant="outline"
            onClick={handleSplit}
            disabled={!canSplitAtPlayhead()}
            title="Split at playhead (S)"
          >
            <Scissors className="h-4 w-4 mr-2" />
            Split
          </Button>

          {/* Delete Button */}
          <Button
            variant="outline"
            onClick={() => editorState.selectedOverlayId && editorState.deleteOverlay(editorState.selectedOverlayId)}
            disabled={!editorState.selectedOverlayId}
            title="Delete selected overlay (Delete)"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>

          {/* Timeline Progress */}
          <div className="flex-1">
            <div className="text-sm font-medium mb-2">
              {editorState.formatTime(editorState.currentFrame)} / {editorState.formatTime(editorState.durationInFrames)}
            </div>
            <Slider
              value={[editorState.currentFrame]}
              max={editorState.durationInFrames}
              step={1}
              onValueChange={([value]) => {
                if (editorState.playerRef.current) {
                  editorState.playerRef.current.seekTo(value);
                }
              }}
            />
          </div>

          {/* Zoom Controls */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => handleZoom(-0.2)}
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium min-w-[50px] text-center">
              {Math.round(zoomScale * 100)}%
            </span>
            <Button
              variant="outline"
              size="icon"
              onClick={() => handleZoom(0.2)}
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
          </div>

          {/* Export Button */}
          <Button 
            onClick={() => setExportDialogOpen(true)}
            disabled={editorState.overlays.length === 0}
          >
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </Card>

      <ExportDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
        onExport={handleExport}
      />
    </>
  );
};

const EditorContent: React.FC = () => {
  const editorState = useEditorState();

  return (
    <EditorProvider value={editorState}>
      <SidebarProvider>
        <TimelineProvider>
          <UISidebarProvider>
            <div className="flex h-screen w-full">
              <EditorSidebar />
              
              <SidebarInset className="flex flex-col overflow-hidden">
                {/* Header */}
                <header className="flex items-center gap-2 border-b p-4">
                  <SidebarTrigger />
                  <div className="flex items-center gap-2">
                    <h1 className="text-xl font-semibold">Video Editor</h1>
                  </div>
                </header>

                {/* Video Player */}
                <div className="flex-1 p-4 overflow-auto">
                  <VideoPlayer playerRef={editorState.playerRef} />
                </div>

                {/* Controls */}
                <div className="p-4">
                  <EditorControls />
                </div>

                {/* Timeline */}
                <div className="p-4 border-t">
                  <AdvancedTimeline onTimelineClick={editorState.handleTimelineClick} />
                </div>
              </SidebarInset>
            </div>
          </UISidebarProvider>
        </TimelineProvider>
      </SidebarProvider>
    </EditorProvider>
  );
};

export const RVEEditor: React.FC = () => {
  return <EditorContent />;
};
