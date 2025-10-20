import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Scissors, Film, Image, Music, Type, Smile, Palette } from "lucide-react";
import { VideoProject, TimelineClip } from "@/pages/content-studio/VideoEditor";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { StickerPickerDialog } from "./StickerPickerDialog";

interface ToolsSidebarProps {
  activeTool: string;
  onToolChange: (tool: string) => void;
  project: VideoProject;
  onProjectUpdate: (updates: Partial<VideoProject>) => void;
}

const tools = [
  { id: 'split', icon: Scissors, label: 'Split', description: 'Cut clips' },
  { id: 'add-clip', icon: Film, label: 'Add Clip', description: 'Video overlay' },
  { id: 'add-image', icon: Image, label: 'Add Image', description: 'Image overlay' },
  { id: 'add-audio', icon: Music, label: 'Add Audio', description: 'Background music' },
  { id: 'add-text', icon: Type, label: 'Add Text', description: 'Text overlays' },
  { id: 'add-sticker', icon: Smile, label: 'Add Sticker', description: 'Emojis & GIFs' },
  { id: 'filters', icon: Palette, label: 'Filters', description: 'Color effects' },
];

export const ToolsSidebar = ({ activeTool, onToolChange, project, onProjectUpdate }: ToolsSidebarProps) => {
  const [stickerDialogOpen, setStickerDialogOpen] = useState(false);

  const handleAddClip = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'video/*';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        try {
          const loadingToast = toast.loading("Adding video overlay...");
          
          const url = URL.createObjectURL(file);
          const videoTrack = project.tracks.find(t => t.id === 'video-2');
          
          if (videoTrack) {
            const newClip: TimelineClip = {
              id: `clip-${Date.now()}`,
              type: 'video',
              trackId: 'video-2',
              start: project.currentTime,
              end: project.currentTime + 5,
              enabled: true,
              sourceUrl: url,
              volume: 100,
              speed: 1,
              content: {
                position: { x: 70, y: 10, width: 25, height: 25 }
              }
            };
            
            const updatedTracks = project.tracks.map(t =>
              t.id === 'video-2' ? { ...t, clips: [...t.clips, newClip] } : t
            );
            
            onProjectUpdate({ tracks: updatedTracks });
            toast.dismiss(loadingToast);
            toast.success("Video clip added");
          }
        } catch (error) {
          toast.error("Failed to add video clip");
          console.error('Error adding video clip:', error);
        }
      }
    };
    input.click();
  };

  const handleAddImage = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        try {
          const loadingToast = toast.loading("Adding image...");
          
          const url = URL.createObjectURL(file);
          const videoTrack = project.tracks.find(t => t.id === 'video-2');
          
          if (videoTrack) {
            const newClip: TimelineClip = {
              id: `image-${Date.now()}`,
              type: 'image',
              trackId: 'video-2',
              start: project.currentTime,
              end: project.currentTime + 3,
              enabled: true,
              sourceUrl: url,
              content: {
                position: { x: 70, y: 10, width: 25, height: 25 }
              }
            };
            
            const updatedTracks = project.tracks.map(t =>
              t.id === 'video-2' ? { ...t, clips: [...t.clips, newClip] } : t
            );
            
            onProjectUpdate({ tracks: updatedTracks });
            toast.dismiss(loadingToast);
            toast.success("Image added");
          }
        } catch (error) {
          toast.error("Failed to add image");
          console.error('Error adding image:', error);
        }
      }
    };
    input.click();
  };

  const handleAddAudio = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'audio/*';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const url = URL.createObjectURL(file);
        const audioTrack = project.tracks.find(t => t.id === 'audio-1');
        if (audioTrack) {
          const newClip: TimelineClip = {
            id: `audio-${Date.now()}`,
            type: 'audio',
            trackId: 'audio-1',
            start: project.currentTime,
            end: project.currentTime + 10,
            enabled: true,
            sourceUrl: url,
            volume: 100,
          };
          const updatedTracks = project.tracks.map(t =>
            t.id === 'audio-1' ? { ...t, clips: [...t.clips, newClip] } : t
          );
          onProjectUpdate({ tracks: updatedTracks });
          toast.success("Audio added");
        }
      }
    };
    input.click();
  };

  const handleAddText = () => {
    const textTrack = project.tracks.find(t => t.id === 'text-1');
    if (textTrack) {
      const newClip: TimelineClip = {
        id: `text-${Date.now()}`,
        type: 'text',
        trackId: 'text-1',
        start: project.currentTime,
        end: project.currentTime + 3,
        enabled: true,
        content: {
          text: 'New Text',
          fontSize: 48,
          fontFamily: 'Arial',
          color: '#ffffff',
          position: { x: 50, y: 50 },
          animation: 'fade',
        },
      };
      const updatedTracks = project.tracks.map(t =>
        t.id === 'text-1' ? { ...t, clips: [...t.clips, newClip] } : t
      );
      onProjectUpdate({ tracks: updatedTracks });
      toast.success("Text added");
    }
  };

  const handleAddSticker = (emoji: string) => {
    const stickerTrack = project.tracks.find(t => t.id === 'sticker-1');
    if (stickerTrack) {
      const newClip: TimelineClip = {
        id: `sticker-${Date.now()}`,
        type: 'sticker',
        trackId: 'sticker-1',
        start: project.currentTime,
        end: project.currentTime + 2,
        enabled: true,
        content: {
          emoji: emoji,
          scale: 100,
          rotation: 0,
          position: { x: 50, y: 50 },
          animation: 'bounce',
        },
      };
      const updatedTracks = project.tracks.map(t =>
        t.id === 'sticker-1' ? { ...t, clips: [...t.clips, newClip] } : t
      );
      onProjectUpdate({ tracks: updatedTracks });
      toast.success(`Sticker ${emoji} added`);
    }
  };

  const handleToolClick = (toolId: string) => {
    onToolChange(toolId);
    
    // Execute tool action immediately for add tools
    switch (toolId) {
      case 'add-clip':
        handleAddClip();
        break;
      case 'add-image':
        handleAddImage();
        break;
      case 'add-audio':
        handleAddAudio();
        break;
      case 'add-text':
        handleAddText();
        break;
      case 'add-sticker':
        setStickerDialogOpen(true);
        break;
    }
  };

  return (
    <div className="w-[200px] flex-none border-r border-border bg-card">
      <ScrollArea className="h-full">
        <div className="p-2 space-y-1">
          {tools.map((tool) => {
            const Icon = tool.icon;
            const isActive = activeTool === tool.id;
            
            return (
              <Button
                key={tool.id}
                variant={isActive ? "secondary" : "ghost"}
                className="w-full justify-start h-auto py-3 px-3"
                onClick={() => handleToolClick(tool.id)}
              >
                <div className="flex items-start gap-3 w-full">
                  <Icon className="h-5 w-5 flex-shrink-0 mt-0.5" />
                  <div className="flex flex-col items-start text-left flex-1 min-w-0">
                    <span className="font-medium text-sm">{tool.label}</span>
                    <span className="text-xs text-muted-foreground">{tool.description}</span>
                  </div>
                </div>
              </Button>
            );
          })}
        </div>
        
        {activeTool === 'filters' && (
          <>
            <Separator className="my-2" />
            <div className="p-3 space-y-3">
              <div className="text-sm font-medium">Filters</div>
              <div className="space-y-2">
                <div className="text-xs text-muted-foreground">Brightness</div>
                <input
                  type="range"
                  min="0"
                  max="200"
                  value={project.filters.brightness}
                  onChange={(e) => onProjectUpdate({
                    filters: { ...project.filters, brightness: Number(e.target.value) }
                  })}
                  className="w-full"
                />
                <div className="text-xs text-muted-foreground">Contrast</div>
                <input
                  type="range"
                  min="0"
                  max="200"
                  value={project.filters.contrast}
                  onChange={(e) => onProjectUpdate({
                    filters: { ...project.filters, contrast: Number(e.target.value) }
                  })}
                  className="w-full"
                />
                <div className="text-xs text-muted-foreground">Saturation</div>
                <input
                  type="range"
                  min="0"
                  max="200"
                  value={project.filters.saturation}
                  onChange={(e) => onProjectUpdate({
                    filters: { ...project.filters, saturation: Number(e.target.value) }
                  })}
                  className="w-full"
                />
              </div>
            </div>
          </>
        )}
      </ScrollArea>

      <StickerPickerDialog
        open={stickerDialogOpen}
        onOpenChange={setStickerDialogOpen}
        onSelect={handleAddSticker}
      />
    </div>
  );
};
