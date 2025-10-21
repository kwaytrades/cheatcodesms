import React from "react";
import { EditorProvider } from "@/contexts/video-editor/EditorContext";
import { useEditorState } from "@/hooks/video-editor/useEditorState";
import { VideoPlayer } from "./VideoPlayer";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Play, Pause, Plus, Download } from "lucide-react";
import { OverlayType } from "@/lib/video-editor/types";

export const RVEEditor: React.FC = () => {
  const editorState = useEditorState();

  const handleAddText = () => {
    editorState.addOverlay({
      id: Date.now(),
      type: OverlayType.TEXT,
      content: "New Text",
      from: editorState.currentFrame,
      durationInFrames: 90,
      left: 100,
      top: 100,
      width: 300,
      height: 100,
      row: 0,
      rotation: 0,
      isDragging: false,
      styles: {
        fontSize: "32px",
        fontWeight: "bold",
        color: "#ffffff",
        backgroundColor: "transparent",
        fontFamily: "Arial",
        fontStyle: "normal",
        textDecoration: "none",
        textAlign: "center",
        opacity: 1,
      },
    });
  };

  const handleAddImage = () => {
    const url = prompt("Enter image URL:");
    if (url) {
      editorState.addOverlay({
        id: Date.now(),
        type: OverlayType.IMAGE,
        src: url,
        from: editorState.currentFrame,
        durationInFrames: 90,
        left: 100,
        top: 100,
        width: 400,
        height: 300,
        row: 1,
        rotation: 0,
        isDragging: false,
        styles: {
          objectFit: "contain",
          opacity: 1,
        },
      });
    }
  };

  const handleExport = () => {
    console.log("Export not implemented yet");
  };

  return (
    <EditorProvider value={editorState}>
      <div className="flex flex-col h-screen bg-background">
        {/* Header */}
        <div className="border-b p-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold">Video Editor</h1>
          <Button onClick={handleExport} disabled={editorState.overlays.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
        
        {/* Video Player */}
        <div className="flex-1 flex items-center justify-center p-4">
          <VideoPlayer playerRef={editorState.playerRef} />
        </div>

        {/* Controls */}
        <Card className="p-4 space-y-4">
          <div className="flex items-center gap-4">
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

            <div className="flex-1">
              <div className="text-sm font-medium">
                {editorState.formatTime(editorState.currentFrame)} / {editorState.formatTime(editorState.durationInFrames)}
              </div>
              <div className="w-full h-2 bg-muted rounded-full mt-2 cursor-pointer" onClick={editorState.handleTimelineClick}>
                <div
                  className="h-full bg-primary rounded-full transition-all"
                  style={{
                    width: `${(editorState.currentFrame / editorState.durationInFrames) * 100}%`,
                  }}
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleAddText}>
                <Plus className="h-4 w-4 mr-2" />
                Add Text
              </Button>
              <Button variant="outline" size="sm" onClick={handleAddImage}>
                <Plus className="h-4 w-4 mr-2" />
                Add Image
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </EditorProvider>
  );
};
