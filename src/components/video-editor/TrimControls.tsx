import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Scissors, Trash2, RotateCcw } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { VideoProject } from "@/pages/content-studio/VideoEditor";

interface TrimControlsProps {
  project: VideoProject;
  onSplitAtTime: (time: number) => void;
  onDeleteClip: (clipId: string) => void;
  onRestoreClip: (clipId: string) => void;
}

export const TrimControls = ({ project, onSplitAtTime, onDeleteClip, onRestoreClip }: TrimControlsProps) => {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  };

  const enabledClips = project.clips.filter(c => c.enabled);
  const disabledClips = project.clips.filter(c => !c.enabled);
  const totalDuration = enabledClips.reduce((sum, clip) => sum + (clip.end - clip.start), 0);

  return (
    <div className="space-y-4 h-full flex flex-col">
      <div className="flex-none">
        <div className="flex items-center gap-2 text-muted-foreground mb-3">
          <Scissors className="h-4 w-4" />
          <span className="text-sm font-medium">Split & Cut</span>
        </div>

        <Button
          onClick={() => onSplitAtTime(project.currentTime)}
          className="w-full"
          size="sm"
        >
          <Scissors className="h-4 w-4 mr-2" />
          Split at Current Time
        </Button>

        <p className="text-xs text-muted-foreground mt-2 text-center">
          Current: {formatTime(project.currentTime)}
        </p>
      </div>

      <div className="flex-1 min-h-0 flex flex-col">
        <Label className="mb-2">Active Clips</Label>
        <ScrollArea className="flex-1 border rounded-lg">
          <div className="space-y-2 p-2">
            {enabledClips.length > 0 ? (
              enabledClips.map((clip, index) => (
                <div
                  key={clip.id}
                  className="p-3 bg-muted/50 rounded-lg space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Clip {index + 1}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onDeleteClip(clip.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <div>Start: {formatTime(clip.start)}</div>
                    <div>End: {formatTime(clip.end)}</div>
                    <div>Duration: {formatTime(clip.end - clip.start)}</div>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                No active clips
              </p>
            )}
          </div>
        </ScrollArea>
      </div>

      {disabledClips.length > 0 && (
        <div className="flex-none">
          <Label className="mb-2">Removed Clips</Label>
          <ScrollArea className="max-h-32 border rounded-lg">
            <div className="space-y-2 p-2">
              {disabledClips.map((clip, index) => (
                <div
                  key={clip.id}
                  className="p-2 bg-muted/30 rounded-lg flex items-center justify-between"
                >
                  <span className="text-xs text-muted-foreground">
                    {formatTime(clip.start)} - {formatTime(clip.end)}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onRestoreClip(clip.id)}
                  >
                    <RotateCcw className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}

      <div className="flex-none p-3 bg-primary/10 rounded-lg text-sm">
        <div className="font-medium">Final Duration:</div>
        <div className="text-lg tabular-nums">{formatTime(totalDuration)}</div>
      </div>

      <div className="flex-none p-2 bg-muted/50 rounded-lg text-xs text-muted-foreground">
        <p>💡 Split clips at any point, then remove unwanted segments by clicking the trash icon.</p>
      </div>
    </div>
  );
};
