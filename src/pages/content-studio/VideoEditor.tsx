import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Save, Download, Undo, Redo } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { VideoEditorCanvas } from "@/components/video-editor/VideoEditorCanvas";
import { ToolsSidebar } from "@/components/video-editor/ToolsSidebar";
import { MultiTrackTimeline } from "@/components/video-editor/MultiTrackTimeline";
import { PropertiesPanel } from "@/components/video-editor/PropertiesPanel";
import { CanvasResizeDialog } from "@/components/video-editor/CanvasResizeDialog";
import { ExportDialog } from "@/components/video-editor/ExportDialog";

export interface TextLayer {
  id: string;
  text: string;
  startTime: number;
  endTime: number;
  position: { x: number; y: number };
  style: {
    fontSize: number;
    fontFamily: string;
    color: string;
    backgroundColor?: string;
  };
  animation?: 'none' | 'fade' | 'slide' | 'typewriter' | 'bounce';
}

export interface VideoFilters {
  brightness: number;
  contrast: number;
  saturation: number;
  temperature: number;
  preset?: string;
}

export type ClipType = 'video' | 'audio' | 'text' | 'sticker' | 'image';

export interface TimelineClip {
  id: string;
  type: ClipType;
  trackId: string;
  start: number;
  end: number;
  enabled: boolean;
  sourceUrl?: string;
  thumbnail?: string;
  content?: any;
  volume?: number;
  speed?: number;
}

export interface Track {
  id: string;
  type: ClipType;
  name: string;
  clips: TimelineClip[];
  height: number;
  locked?: boolean;
  visible?: boolean;
}

export interface CanvasSize {
  width: number;
  height: number;
  aspectRatio: string;
  name: string;
}

export interface VideoProject {
  id?: string;
  sourceVideo: string;
  duration: number;
  currentTime: number;
  isPlaying: boolean;
  tracks: Track[];
  filters: VideoFilters;
  volume: number;
  projectName: string;
  canvasSize: CanvasSize;
  zoomLevel: number;
  timelineZoom: number;
}

const VideoEditor = () => {
  const location = useLocation();
  const videoData = location.state?.video;

  const [project, setProject] = useState<VideoProject>({
    sourceVideo: "",
    duration: videoData?.duration_seconds || 0,
    currentTime: 0,
    isPlaying: false,
    tracks: [
      {
        id: 'video-1',
        type: 'video',
        name: 'Main Video',
        clips: [],
        height: 80,
        visible: true,
      },
      {
        id: 'audio-1',
        type: 'audio',
        name: 'Audio Track',
        clips: [],
        height: 50,
        visible: true,
      },
      {
        id: 'text-1',
        type: 'text',
        name: 'Text Track',
        clips: [],
        height: 40,
        visible: true,
      },
      {
        id: 'sticker-1',
        type: 'sticker',
        name: 'Sticker Track',
        clips: [],
        height: 40,
        visible: true,
      },
    ],
    filters: {
      brightness: 100,
      contrast: 100,
      saturation: 100,
      temperature: 0,
    },
    volume: 100,
    projectName: `Edit - ${videoData?.script_id || 'New Project'}`,
    canvasSize: {
      width: 1920,
      height: 1080,
      aspectRatio: '16:9',
      name: 'YouTube (1080p)',
    },
    zoomLevel: 100,
    timelineZoom: 1,
  });

  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<string>('select');
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [canvasDialogOpen, setCanvasDialogOpen] = useState(false);
  const [overlayTrackCounter, setOverlayTrackCounter] = useState(1);
  const [imageTrackCounter, setImageTrackCounter] = useState(1);

  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingVideo, setIsLoadingVideo] = useState(true);

  // Load video with signed URL
  useEffect(() => {
    const loadVideo = async () => {
      if (!videoData?.video_url) {
        toast.error("No video source provided");
        setIsLoadingVideo(false);
        return;
      }

      try {
        // Extract the path from the full URL or use as-is if it's already a path
        const storagePath = videoData.video_url.includes('content-videos/') 
          ? videoData.video_url.split('content-videos/')[1]
          : videoData.video_url;

        // Get signed URL for private videos
        const { data, error } = await supabase.storage
          .from('content-videos')
          .createSignedUrl(storagePath, 3600); // 1 hour expiry

        if (error) {
          console.error('Error getting signed URL:', error);
          // Try using the URL directly as fallback
          setProject(prev => ({ ...prev, sourceVideo: videoData.video_url }));
        } else if (data?.signedUrl) {
          setProject(prev => ({
            ...prev,
            sourceVideo: data.signedUrl,
            tracks: prev.tracks.map(track => 
              track.id === 'video-1' && track.clips.length === 0
                ? {
                    ...track,
                    clips: [{
                      id: 'main-video',
                      type: 'video' as const,
                      trackId: 'video-1',
                      start: 0,
                      end: prev.duration,
                      enabled: true,
                      sourceUrl: data.signedUrl,
                      volume: 100,
                      speed: 1,
                    }]
                  }
                : track
            ),
          }));
        }
      } catch (error) {
        console.error('Error loading video:', error);
        toast.error("Failed to load video");
      } finally {
        setIsLoadingVideo(false);
      }
    };

    loadVideo();
  }, [videoData]);

  const handleSaveProject = async () => {
    try {
      setIsSaving(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast.error("You must be logged in to save");
        return;
      }

      const projectData = {
        user_id: user.id,
        source_video_id: videoData?.id || null,
        project_name: project.projectName,
        timeline_data: {
          tracks: project.tracks,
          filters: project.filters,
          canvasSize: project.canvasSize,
          volume: project.volume,
        } as any,
        duration_seconds: project.duration,
        status: 'draft' as const,
      };

      const dataToUpsert = project.id ? { id: project.id, ...projectData } : projectData;

      const { error } = await supabase
        .from('video_projects')
        .upsert([dataToUpsert]);

      if (error) throw error;

      toast.success("Project saved successfully");
    } catch (error) {
      console.error("Error saving project:", error);
      toast.error("Failed to save project");
    } finally {
      setIsSaving(false);
    }
  };

  const updateProject = (updates: Partial<VideoProject>) => {
    setProject(prev => ({ ...prev, ...updates }));
  };

  const getSelectedClip = () => {
    if (!selectedClipId) return null;
    for (const track of project.tracks) {
      const clip = track.clips.find(c => c.id === selectedClipId);
      if (clip) return { clip, track };
    }
    return null;
  };

  if (isLoadingVideo) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading video...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Top Bar */}
      <div className="flex-none border-b border-border bg-card px-4 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Input
              value={project.projectName}
              onChange={(e) => updateProject({ projectName: e.target.value })}
              className="w-64 h-8"
            />
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" disabled className="h-8 w-8 p-0">
                <Undo className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="ghost" disabled className="h-8 w-8 p-0">
                <Redo className="h-4 w-4" />
              </Button>
            </div>
            <Button 
              size="sm" 
              variant="outline" 
              onClick={() => setCanvasDialogOpen(true)}
              className="h-8"
            >
              📐 {project.canvasSize.name}
            </Button>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleSaveProject} disabled={isSaving} variant="outline" size="sm" className="h-8">
              <Save className="h-4 w-4 mr-2" />
              Save
            </Button>
            <Button onClick={() => setExportDialogOpen(true)} size="sm" className="h-8">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </div>
      </div>

      {/* Main Editor Area */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Left Sidebar - Tools */}
        <ToolsSidebar 
          activeTool={activeTool}
          onToolChange={setActiveTool}
          project={project}
          onProjectUpdate={updateProject}
          overlayTrackCounter={overlayTrackCounter}
          imageTrackCounter={imageTrackCounter}
          onOverlayTrackIncrement={() => setOverlayTrackCounter(prev => prev + 1)}
          onImageTrackIncrement={() => setImageTrackCounter(prev => prev + 1)}
        />

        {/* Center - Video Preview */}
        <div className="flex-1 flex flex-col min-h-0 bg-muted/20">
          <VideoEditorCanvas
            project={project}
            selectedClipId={selectedClipId}
            onTimeUpdate={(currentTime) => updateProject({ currentTime })}
            onPlayingChange={(isPlaying) => updateProject({ isPlaying })}
            onProjectUpdate={updateProject}
            onClipSelect={setSelectedClipId}
          />
        </div>

        {/* Right Panel - Properties */}
        {selectedClipId && (
          <PropertiesPanel
            selectedClip={getSelectedClip()}
            project={project}
            onProjectUpdate={updateProject}
            onClipDeselect={() => setSelectedClipId(null)}
          />
        )}
      </div>

      {/* Bottom Timeline (40% of screen height) */}
      <div className="flex-none border-t border-border bg-card" style={{ height: '40vh' }}>
        <MultiTrackTimeline
          project={project}
          selectedClipId={selectedClipId}
          activeTool={activeTool}
          onProjectUpdate={updateProject}
          onClipSelect={setSelectedClipId}
        />
      </div>

      {/* Dialogs */}
      <ExportDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
        project={project}
      />
      
      <CanvasResizeDialog
        open={canvasDialogOpen}
        onOpenChange={setCanvasDialogOpen}
        currentCanvas={project.canvasSize}
        onCanvasChange={(canvasSize) => updateProject({ canvasSize })}
      />
    </div>
  );
};

export default VideoEditor;
