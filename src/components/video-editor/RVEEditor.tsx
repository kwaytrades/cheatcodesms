import React, { useState, useEffect } from "react";
import { EditorProvider, useEditorContext } from "@/contexts/video-editor/EditorContext";
import { SidebarProvider } from "@/contexts/video-editor/SidebarContext";
import { TimelineProvider } from "@/contexts/video-editor/TimelineContext";
import { SidebarProvider as UISidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { useEditorState } from "@/hooks/video-editor/useEditorState";
import { useVideoExport } from "@/hooks/video-editor/useVideoExport";
import { VideoPlayer } from "./VideoPlayer";
import { EditorSidebar } from "./sidebar/EditorSidebar";
import { AdvancedTimeline } from "./timeline/AdvancedTimeline";
import { ExportDialog } from "./export/ExportDialog";
import { AspectRatioSelector } from "./AspectRatioSelector";
import { ProjectManager, ProjectData } from "./ProjectManager";
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
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

const EditorControls: React.FC = () => {
  const editorState = useEditorContext();
  const { zoomScale, handleZoom } = useTimeline();
  const { exportVideo, cancelExport, progress: exportProgress, isLoading } = useVideoExport(
    editorState.overlays,
    editorState.durationInFrames,
    30, // FPS
    editorState.getAspectRatioDimensions
  );
  const [exportDialogOpen, setExportDialogOpen] = useState(false);

  // Enable keyboard shortcuts
  useKeyboardShortcuts();

  const handleExport = async (settings: any) => {
    try {
      await exportVideo();
      setExportDialogOpen(false);
    } catch (error: any) {
      console.error("Export failed:", error);
      toast.error("Failed to export video");
    }
  };

  const handleCancelExport = () => {
    cancelExport();
    setExportDialogOpen(false);
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
        onCancel={handleCancelExport}
        currentProgress={exportProgress}
      />
    </>
  );
};

const EditorContent: React.FC = () => {
  const editorState = useEditorState();
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [projectName, setProjectName] = useState("Untitled Project");
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // Auto-save every 30 seconds
  useEffect(() => {
    if (!currentProjectId || editorState.overlays.length === 0) return;

    const autoSave = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const maxEnd = editorState.overlays.reduce((max, o) => 
          Math.max(max, o.from + o.durationInFrames), 0
        );
        const durationSeconds = Math.ceil(maxEnd / 30);

        await supabase
          .from("video_projects")
          .update({
            timeline_data: {
              overlays: editorState.overlays,
              aspectRatio: editorState.aspectRatio,
            },
            duration_seconds: durationSeconds,
            updated_at: new Date().toISOString(),
          })
          .eq("id", currentProjectId);

        setLastSaved(new Date());
        console.log("Project auto-saved");
      } catch (error) {
        console.error("Auto-save failed:", error);
      }
    };

    const interval = setInterval(autoSave, 30000); // 30 seconds
    return () => clearInterval(interval);
  }, [currentProjectId, editorState.overlays, editorState.aspectRatio]);

  const handleSaveProject = (projectId: string) => {
    setCurrentProjectId(projectId);
    setLastSaved(new Date());
  };

  const handleLoadProject = (projectId: string, data: ProjectData) => {
    setCurrentProjectId(projectId);
    setProjectName(data.project_name);
    editorState.setOverlays(data.timeline_data.overlays);
    editorState.setAspectRatio(data.timeline_data.aspectRatio);
    setLastSaved(new Date());
  };

  const handleNewProject = () => {
    if (editorState.overlays.length > 0) {
      if (!confirm("Start a new project? Unsaved changes will be lost.")) {
        return;
      }
    }
    setCurrentProjectId(null);
    setProjectName("Untitled Project");
    editorState.resetOverlays();
    editorState.setAspectRatio("16:9");
  };

  return (
    <EditorProvider value={editorState}>
      <SidebarProvider>
        <TimelineProvider>
          <UISidebarProvider>
            <div className="flex h-screen w-full">
              <EditorSidebar />
              
              <SidebarInset className="flex flex-col overflow-hidden">
                {/* Header */}
                <header className="flex items-center justify-between gap-2 border-b p-2 shrink-0">
                  <div className="flex items-center gap-2">
                    <SidebarTrigger />
                    <h1 className="text-xl font-semibold">{projectName}</h1>
                    {lastSaved && (
                      <span className="text-xs text-muted-foreground">
                        Saved {formatDistanceToNow(lastSaved, { addSuffix: true })}
                      </span>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <ProjectManager
                      currentProjectId={currentProjectId}
                      currentProjectName={projectName}
                      overlays={editorState.overlays}
                      aspectRatio={editorState.aspectRatio}
                      onProjectNameChange={setProjectName}
                      onSave={handleSaveProject}
                      onLoad={handleLoadProject}
                      onNew={handleNewProject}
                    />
                    
                    <AspectRatioSelector
                      currentRatio={editorState.aspectRatio}
                      onRatioChange={editorState.setAspectRatio}
                    />
                  </div>
                </header>

                {/* Video Player - Takes most space */}
                <div className="flex-1 min-h-0 overflow-hidden">
                  <VideoPlayer playerRef={editorState.playerRef} />
                </div>

                {/* Controls */}
                <div className="p-2 shrink-0">
                  <EditorControls />
                </div>

                {/* Timeline */}
                <div className="h-48 border-t shrink-0 overflow-hidden">
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
