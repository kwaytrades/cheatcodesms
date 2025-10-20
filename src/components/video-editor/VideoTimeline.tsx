import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Play, Pause, SkipBack, SkipForward } from "lucide-react";
import { VideoProject } from "@/pages/content-studio/VideoEditor";

interface VideoTimelineProps {
  project: VideoProject;
  onTimeChange: (time: number) => void;
  onPlayPause: () => void;
}

export const VideoTimeline = ({ project, onTimeChange, onPlayPause }: VideoTimelineProps) => {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSkip = (delta: number) => {
    const newTime = Math.max(
      project.trimPoints.start,
      Math.min(project.trimPoints.end, project.currentTime + delta)
    );
    onTimeChange(newTime);
  };

  return (
    <div className="space-y-4">
      {/* Playback Controls */}
      <div className="flex items-center justify-center gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => handleSkip(-5)}
        >
          <SkipBack className="h-4 w-4" />
        </Button>
        
        <Button onClick={onPlayPause}>
          {project.isPlaying ? (
            <Pause className="h-4 w-4" />
          ) : (
            <Play className="h-4 w-4" />
          )}
        </Button>
        
        <Button
          size="sm"
          variant="outline"
          onClick={() => handleSkip(5)}
        >
          <SkipForward className="h-4 w-4" />
        </Button>

        <span className="text-sm tabular-nums ml-4">
          {formatTime(project.currentTime)} / {formatTime(project.duration)}
        </span>
      </div>

      {/* Timeline Slider */}
      <div className="space-y-2">
        <Slider
          value={[project.currentTime]}
          min={0}
          max={project.duration}
          step={0.1}
          onValueChange={([value]) => onTimeChange(value)}
          className="w-full"
        />

        {/* Clips & Text Layers Visualization */}
        <div className="relative h-12 bg-muted/20 rounded">
          {/* Clip segments */}
          {project.clips
            .filter(clip => clip.enabled)
            .map((clip) => (
              <div
                key={clip.id}
                className="absolute h-6 bg-primary/30 border border-primary rounded top-0"
                style={{
                  left: `${(clip.start / project.duration) * 100}%`,
                  width: `${((clip.end - clip.start) / project.duration) * 100}%`,
                }}
                title={`Clip: ${clip.start.toFixed(1)}s - ${clip.end.toFixed(1)}s`}
              />
            ))}
          
          {/* Text Layer Markers */}
          {project.textLayers.map((layer) => (
            <div
              key={layer.id}
              className="absolute h-3 bg-secondary rounded-full top-7"
              style={{
                left: `${(layer.startTime / project.duration) * 100}%`,
                width: `${((layer.endTime - layer.startTime) / project.duration) * 100}%`,
              }}
              title={layer.text}
            />
          ))}

          {/* Current Time Marker */}
          <div
            className="absolute w-0.5 h-full bg-destructive z-10"
            style={{
              left: `${(project.currentTime / project.duration) * 100}%`,
            }}
          />
        </div>
      </div>
    </div>
  );
};
