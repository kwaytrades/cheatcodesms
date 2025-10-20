import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Save, Download, Undo, Redo } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { VideoEditorCanvas } from "@/components/video-editor/VideoEditorCanvas";
import { VideoTimeline } from "@/components/video-editor/VideoTimeline";
import { TextOverlayPanel } from "@/components/video-editor/TextOverlayPanel";
import { TrimControls } from "@/components/video-editor/TrimControls";
import { FilterPanel } from "@/components/video-editor/FilterPanel";
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
  animation?: 'none' | 'fade' | 'slide';
}

export interface VideoFilters {
  brightness: number;
  contrast: number;
  saturation: number;
  temperature: number;
  preset?: string;
}

export interface VideoProject {
  id?: string;
  sourceVideo: string;
  duration: number;
  currentTime: number;
  isPlaying: boolean;
  trimPoints: { start: number; end: number };
  textLayers: TextLayer[];
  filters: VideoFilters;
  volume: number;
  projectName: string;
}

const VideoEditor = () => {
  const location = useLocation();
  const videoData = location.state?.video;

  const [project, setProject] = useState<VideoProject>({
    sourceVideo: videoData?.video_url || "",
    duration: videoData?.duration_seconds || 0,
    currentTime: 0,
    isPlaying: false,
    trimPoints: { start: 0, end: videoData?.duration_seconds || 0 },
    textLayers: [],
    filters: {
      brightness: 100,
      contrast: 100,
      saturation: 100,
      temperature: 0,
    },
    volume: 100,
    projectName: `Edit - ${videoData?.script_id || 'New Project'}`,
  });

  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!videoData?.video_url) {
      toast.error("No video source provided");
    }
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
          textLayers: project.textLayers,
          filters: project.filters,
          trimPoints: project.trimPoints,
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

  const addTextLayer = () => {
    const newLayer: TextLayer = {
      id: `text-${Date.now()}`,
      text: 'New Text',
      startTime: project.currentTime,
      endTime: Math.min(project.currentTime + 3, project.duration),
      position: { x: 50, y: 50 },
      style: {
        fontSize: 32,
        fontFamily: 'Arial',
        color: '#ffffff',
      },
      animation: 'fade',
    };

    updateProject({
      textLayers: [...project.textLayers, newLayer],
    });

    toast.success("Text layer added");
  };

  const updateTextLayer = (id: string, updates: Partial<TextLayer>) => {
    updateProject({
      textLayers: project.textLayers.map(layer =>
        layer.id === id ? { ...layer, ...updates } : layer
      ),
    });
  };

  const deleteTextLayer = (id: string) => {
    updateProject({
      textLayers: project.textLayers.filter(layer => layer.id !== id),
    });
    toast.success("Text layer deleted");
  };

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Top Toolbar */}
      <div className="flex-none border-b border-border bg-card">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-4">
            <Input
              value={project.projectName}
              onChange={(e) => updateProject({ projectName: e.target.value })}
              className="w-64"
            />
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" disabled>
                <Undo className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="ghost" disabled>
                <Redo className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleSaveProject} disabled={isSaving} variant="outline">
              <Save className="h-4 w-4 mr-2" />
              Save Project
            </Button>
            <Button onClick={() => setExportDialogOpen(true)}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </div>
      </div>

      {/* Main Editor Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Controls */}
        <Card className="w-80 flex-none border-r rounded-none">
          <Tabs defaultValue="text" className="h-full flex flex-col">
            <TabsList className="grid grid-cols-3 m-4">
              <TabsTrigger value="trim">Trim</TabsTrigger>
              <TabsTrigger value="text">Text</TabsTrigger>
              <TabsTrigger value="filters">Filters</TabsTrigger>
            </TabsList>
            
            <div className="flex-1 overflow-auto p-4">
              <TabsContent value="trim" className="mt-0">
                <TrimControls
                  trimPoints={project.trimPoints}
                  duration={project.duration}
                  onTrimChange={(trimPoints) => updateProject({ trimPoints })}
                />
              </TabsContent>

              <TabsContent value="text" className="mt-0">
                <TextOverlayPanel
                  textLayers={project.textLayers}
                  currentTime={project.currentTime}
                  onAddLayer={addTextLayer}
                  onUpdateLayer={updateTextLayer}
                  onDeleteLayer={deleteTextLayer}
                />
              </TabsContent>

              <TabsContent value="filters" className="mt-0">
                <FilterPanel
                  filters={project.filters}
                  onFiltersChange={(filters) => updateProject({ filters })}
                />
              </TabsContent>
            </div>
          </Tabs>
        </Card>

        {/* Center - Video Preview */}
        <div className="flex-1 flex flex-col">
          <div className="flex-1 flex items-center justify-center bg-muted/20 p-8">
            <VideoEditorCanvas
              project={project}
              onTimeUpdate={(currentTime) => updateProject({ currentTime })}
              onPlayingChange={(isPlaying) => updateProject({ isPlaying })}
            />
          </div>

          {/* Timeline */}
          <div className="flex-none border-t border-border bg-card p-4">
            <VideoTimeline
              project={project}
              onTimeChange={(currentTime) => updateProject({ currentTime })}
              onPlayPause={() => updateProject({ isPlaying: !project.isPlaying })}
            />
          </div>
        </div>
      </div>

      {/* Export Dialog */}
      <ExportDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
        project={project}
      />
    </div>
  );
};

export default VideoEditor;
