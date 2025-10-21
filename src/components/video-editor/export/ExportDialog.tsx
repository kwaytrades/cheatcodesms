import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Download, Loader2, Video, Sparkles, Zap } from "lucide-react";
import { toast } from "sonner";
import { 
  ExportSettings, 
  RESOLUTION_PRESETS, 
  QUALITY_PRESETS, 
  ENCODING_PRESETS 
} from "@/lib/video-editor/types";

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onExport: (settings: ExportSettings) => Promise<void>;
  onCancel: () => void;
  currentProgress?: number;
}

export const ExportDialog: React.FC<ExportDialogProps> = ({
  open,
  onOpenChange,
  onExport,
  onCancel,
  currentProgress = 0,
}) => {
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  
  const [resolution, setResolution] = useState<ExportSettings["resolution"]>("1080p");
  const [quality, setQuality] = useState<ExportSettings["quality"]>("high");
  const [preset, setPreset] = useState<ExportSettings["preset"]>("medium");

  const handleExport = async () => {
    setExporting(true);
    setProgress(0);

    try {
      const settings: ExportSettings = {
        resolution,
        quality,
        preset,
      };
      
      await onExport(settings);
      
      setProgress(100);
      toast.success("Video exported successfully!");
      
      setTimeout(() => {
        onOpenChange(false);
        setExporting(false);
        setProgress(0);
      }, 1000);
    } catch (error: any) {
      // Only show error if not cancelled
      if (error?.message !== "Export cancelled") {
        toast.error("Export failed. Please try again.");
      }
      setExporting(false);
      setProgress(0);
    }
  };

  const handleCancel = () => {
    if (exporting) {
      onCancel();
    }
    onOpenChange(false);
    setExporting(false);
    setProgress(0);
  };

  const displayProgress = exporting ? (currentProgress || progress) : 0;
  
  const resolutionData = RESOLUTION_PRESETS[resolution];
  const qualityData = QUALITY_PRESETS[quality];
  const estimatedSizeMB = Math.round(
    (resolutionData.width * resolutionData.height * 0.0001 * 10) / (qualityData.crf / 10)
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Export Video</DialogTitle>
          <DialogDescription>
            Configure export settings and download your video
          </DialogDescription>
        </DialogHeader>

        {exporting ? (
          <div className="space-y-4 py-4">
            <Progress value={displayProgress} />
            <p className="text-sm text-center text-muted-foreground">
              {displayProgress < 50 
                ? "Capturing frames..." 
                : displayProgress < 90 
                ? "Encoding video..." 
                : "Finalizing..."
              } {displayProgress}%
            </p>
            <p className="text-xs text-center text-muted-foreground">
              Exporting at {resolutionData.label} • {qualityData.label}
            </p>
          </div>
        ) : (
          <div className="space-y-6 py-4">
            <div className="space-y-3">
              <Label className="text-base flex items-center gap-2">
                <Video className="h-4 w-4" />
                Resolution
              </Label>
              <RadioGroup value={resolution} onValueChange={(v) => setResolution(v as any)}>
                {Object.entries(RESOLUTION_PRESETS).map(([key, value]) => (
                  <div key={key} className="flex items-center space-x-2">
                    <RadioGroupItem value={key} id={`res-${key}`} />
                    <Label htmlFor={`res-${key}`} className="font-normal cursor-pointer">
                      {value.label}
                      <span className="text-xs text-muted-foreground ml-2">
                        ({value.width}x{value.height})
                      </span>
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            <div className="space-y-3">
              <Label className="text-base flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                Quality
              </Label>
              <RadioGroup value={quality} onValueChange={(v) => setQuality(v as any)}>
                {Object.entries(QUALITY_PRESETS).map(([key, value]) => (
                  <div key={key} className="flex items-center space-x-2">
                    <RadioGroupItem value={key} id={`quality-${key}`} />
                    <Label htmlFor={`quality-${key}`} className="font-normal cursor-pointer flex-1">
                      <div>{value.label}</div>
                      <div className="text-xs text-muted-foreground">
                        {value.description}
                      </div>
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            <div className="space-y-3">
              <Label className="text-base flex items-center gap-2">
                <Zap className="h-4 w-4" />
                Encoding Speed
              </Label>
              <RadioGroup value={preset} onValueChange={(v) => setPreset(v as any)}>
                {Object.entries(ENCODING_PRESETS).map(([key, value]) => (
                  <div key={key} className="flex items-center space-x-2">
                    <RadioGroupItem value={key} id={`preset-${key}`} />
                    <Label htmlFor={`preset-${key}`} className="font-normal cursor-pointer flex-1">
                      <div>{value.label}</div>
                      <div className="text-xs text-muted-foreground">
                        {value.description}
                      </div>
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            <div className="p-3 bg-muted rounded-lg">
              <div className="text-sm font-medium">Export Summary</div>
              <div className="text-xs text-muted-foreground mt-1">
                {resolutionData.label} • {qualityData.label} • {ENCODING_PRESETS[preset].label} encoding
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Estimated file size: ~{estimatedSizeMB}MB for a 30s video
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button 
            variant="outline" 
            onClick={handleCancel}
          >
            Cancel
          </Button>
          <Button onClick={handleExport} disabled={exporting}>
            {exporting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Export
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
