import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { X, Trash2, Copy } from "lucide-react";
import { VideoProject, TimelineClip, Track } from "@/pages/content-studio/VideoEditor";
import { toast } from "sonner";

interface PropertiesPanelProps {
  selectedClip: { clip: TimelineClip; track: Track } | null;
  project: VideoProject;
  onProjectUpdate: (updates: Partial<VideoProject>) => void;
  onClipDeselect: () => void;
}

export const PropertiesPanel = ({
  selectedClip,
  project,
  onProjectUpdate,
  onClipDeselect,
}: PropertiesPanelProps) => {
  if (!selectedClip) return null;

  const { clip, track } = selectedClip;

  const updateClip = (updates: Partial<TimelineClip>) => {
    const updatedTracks = project.tracks.map(t =>
      t.id === track.id
        ? {
            ...t,
            clips: t.clips.map(c => (c.id === clip.id ? { ...c, ...updates } : c)),
          }
        : t
    );
    onProjectUpdate({ tracks: updatedTracks });
  };

  const handleDelete = () => {
    const updatedTracks = project.tracks.map(t =>
      t.id === track.id
        ? {
            ...t,
            clips: t.clips.map(c => (c.id === clip.id ? { ...c, enabled: false } : c)),
          }
        : t
    );
    onProjectUpdate({ tracks: updatedTracks });
    onClipDeselect();
    toast.success("Clip deleted");
  };

  const handleDuplicate = () => {
    const newClip: TimelineClip = {
      ...clip,
      id: `${clip.id}-copy-${Date.now()}`,
      start: clip.end,
      end: clip.end + (clip.end - clip.start),
    };

    const updatedTracks = project.tracks.map(t =>
      t.id === track.id ? { ...t, clips: [...t.clips, newClip] } : t
    );
    onProjectUpdate({ tracks: updatedTracks });
    toast.success("Clip duplicated");
  };

  return (
    <div className="w-[280px] flex-none border-l border-border bg-card flex flex-col">
      {/* Header */}
      <div className="flex-none border-b border-border p-3 flex items-center justify-between">
        <span className="text-sm font-medium">Properties</span>
        <Button variant="ghost" size="sm" onClick={onClipDeselect} className="h-7 w-7 p-0">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-4">
          {/* Clip Type Badge */}
          <div>
            <div className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
              {clip.type.toUpperCase()}
            </div>
          </div>

          <Separator />

          {/* Common Properties */}
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Start Time (s)</Label>
              <Input
                type="number"
                value={clip.start}
                onChange={(e) => updateClip({ start: Number(e.target.value) })}
                step="0.1"
                className="h-8 mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">End Time (s)</Label>
              <Input
                type="number"
                value={clip.end}
                onChange={(e) => updateClip({ end: Number(e.target.value) })}
                step="0.1"
                className="h-8 mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Duration</Label>
              <div className="text-sm text-muted-foreground mt-1">
                {(clip.end - clip.start).toFixed(2)}s
              </div>
            </div>
          </div>

          <Separator />

          {/* Type-Specific Properties */}
          {(clip.type === 'video' || clip.type === 'audio') && (
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Volume (%)</Label>
                <Input
                  type="number"
                  value={clip.volume || 100}
                  onChange={(e) => updateClip({ volume: Number(e.target.value) })}
                  min="0"
                  max="200"
                  className="h-8 mt-1"
                />
              </div>
              {clip.type === 'video' && (
                <div>
                  <Label className="text-xs">Speed</Label>
                  <Select
                    value={String(clip.speed || 1)}
                    onValueChange={(value) => updateClip({ speed: Number(value) })}
                  >
                    <SelectTrigger className="h-8 mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0.25">0.25x</SelectItem>
                      <SelectItem value="0.5">0.5x</SelectItem>
                      <SelectItem value="1">1x</SelectItem>
                      <SelectItem value="1.5">1.5x</SelectItem>
                      <SelectItem value="2">2x</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}

          {clip.type === 'text' && (
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Text Content</Label>
                <Input
                  value={clip.content?.text || ''}
                  onChange={(e) =>
                    updateClip({ content: { ...clip.content, text: e.target.value } })
                  }
                  className="h-8 mt-1"
                  placeholder="Enter text..."
                />
              </div>
              <div>
                <Label className="text-xs">Font Size</Label>
                <Input
                  type="number"
                  value={clip.content?.fontSize || 32}
                  onChange={(e) =>
                    updateClip({ content: { ...clip.content, fontSize: Number(e.target.value) } })
                  }
                  className="h-8 mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Color</Label>
                <Input
                  type="color"
                  value={clip.content?.color || '#ffffff'}
                  onChange={(e) =>
                    updateClip({ content: { ...clip.content, color: e.target.value } })
                  }
                  className="h-8 mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Animation</Label>
                <Select
                  value={clip.content?.animation || 'none'}
                  onValueChange={(value) =>
                    updateClip({ content: { ...clip.content, animation: value } })
                  }
                >
                  <SelectTrigger className="h-8 mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="fade">Fade In</SelectItem>
                    <SelectItem value="slide">Slide In</SelectItem>
                    <SelectItem value="typewriter">Typewriter</SelectItem>
                    <SelectItem value="bounce">Bounce</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {clip.type === 'sticker' && (
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Scale (%)</Label>
                <Input
                  type="number"
                  value={clip.content?.scale || 100}
                  onChange={(e) =>
                    updateClip({ content: { ...clip.content, scale: Number(e.target.value) } })
                  }
                  min="10"
                  max="500"
                  className="h-8 mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Rotation (deg)</Label>
                <Input
                  type="number"
                  value={clip.content?.rotation || 0}
                  onChange={(e) =>
                    updateClip({ content: { ...clip.content, rotation: Number(e.target.value) } })
                  }
                  min="-180"
                  max="180"
                  className="h-8 mt-1"
                />
              </div>
            </div>
          )}

          <Separator />

          {/* Actions */}
          <div className="space-y-2">
            <Button variant="outline" size="sm" onClick={handleDuplicate} className="w-full h-8">
              <Copy className="h-4 w-4 mr-2" />
              Duplicate
            </Button>
            <Button variant="destructive" size="sm" onClick={handleDelete} className="w-full h-8">
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
};
