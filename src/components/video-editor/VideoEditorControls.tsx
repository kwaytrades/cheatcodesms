import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Play, Pause, SkipBack, SkipForward } from "lucide-react";

interface VideoEditorControlsProps {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  onPlayPause: () => void;
  onSeek: (time: number) => void;
}

export const VideoEditorControls = ({
  isPlaying,
  currentTime,
  duration,
  onPlayPause,
  onSeek,
}: VideoEditorControlsProps) => {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => onSeek(Math.max(0, currentTime - 5))}
          >
            <SkipBack className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            onClick={onPlayPause}
          >
            {isPlaying ? (
              <Pause className="h-4 w-4" />
            ) : (
              <Play className="h-4 w-4" />
            )}
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => onSeek(Math.min(duration, currentTime + 5))}
          >
            <SkipForward className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 flex items-center gap-3">
          <span className="text-sm text-muted-foreground min-w-[60px]">
            {formatTime(currentTime)}
          </span>
          <Slider
            value={[currentTime]}
            max={duration || 100}
            step={0.1}
            onValueChange={([value]) => onSeek(value)}
            className="flex-1"
          />
          <span className="text-sm text-muted-foreground min-w-[60px]">
            {formatTime(duration)}
          </span>
        </div>
      </div>
    </div>
  );
};
