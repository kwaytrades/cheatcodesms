import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Scissors } from "lucide-react";

interface TrimControlsProps {
  trimPoints: { start: number; end: number };
  duration: number;
  onTrimChange: (trimPoints: { start: number; end: number }) => void;
}

export const TrimControls = ({ trimPoints, duration, onTrimChange }: TrimControlsProps) => {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  };

  const handleReset = () => {
    onTrimChange({ start: 0, end: duration });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Scissors className="h-4 w-4" />
        <span className="text-sm">Trim Video</span>
      </div>

      <div className="space-y-3">
        <div className="space-y-2">
          <Label>Start Time (seconds)</Label>
          <Input
            type="number"
            value={trimPoints.start}
            onChange={(e) =>
              onTrimChange({
                ...trimPoints,
                start: Math.max(0, Math.min(parseFloat(e.target.value) || 0, trimPoints.end - 0.1)),
              })
            }
            step={0.1}
            min={0}
            max={trimPoints.end - 0.1}
          />
          <p className="text-xs text-muted-foreground">{formatTime(trimPoints.start)}</p>
        </div>

        <div className="space-y-2">
          <Label>End Time (seconds)</Label>
          <Input
            type="number"
            value={trimPoints.end}
            onChange={(e) =>
              onTrimChange({
                ...trimPoints,
                end: Math.min(duration, Math.max(parseFloat(e.target.value) || 0, trimPoints.start + 0.1)),
              })
            }
            step={0.1}
            min={trimPoints.start + 0.1}
            max={duration}
          />
          <p className="text-xs text-muted-foreground">{formatTime(trimPoints.end)}</p>
        </div>

        <div className="pt-2 space-y-2">
          <div className="text-sm">
            <span className="text-muted-foreground">Duration: </span>
            <span className="font-medium">{formatTime(trimPoints.end - trimPoints.start)}</span>
          </div>
          <Button variant="outline" size="sm" onClick={handleReset} className="w-full">
            Reset to Full Video
          </Button>
        </div>
      </div>

      <div className="p-3 bg-muted/50 rounded-lg text-xs text-muted-foreground">
        <p>💡 Tip: Use trim to remove unwanted parts from the beginning or end of your video.</p>
      </div>
    </div>
  );
};
