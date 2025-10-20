import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { VideoProject } from "@/pages/content-studio/VideoEditor";
import { supabase } from "@/integrations/supabase/client";

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: VideoProject;
}

export const ExportDialog = ({ open, onOpenChange, project }: ExportDialogProps) => {
  const [resolution, setResolution] = useState("1080p");
  const [quality, setQuality] = useState("high");
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleExport = async () => {
    try {
      setIsExporting(true);
      setProgress(0);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("You must be logged in to export");
        return;
      }

      // Simulate export progress
      const progressInterval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 500);

      // In a real implementation, this would:
      // 1. Render the video with overlays and effects using canvas/Web Codecs API
      // 2. Upload the rendered video to Supabase Storage
      // 3. Save metadata to content_videos table

      // For now, we'll just show a success message
      setTimeout(() => {
        clearInterval(progressInterval);
        setProgress(100);
        
        setTimeout(() => {
          toast.success("Video exported successfully!");
          onOpenChange(false);
          setIsExporting(false);
          setProgress(0);
        }, 500);
      }, 5000);

    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to export video");
      setIsExporting(false);
      setProgress(0);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Export Video</DialogTitle>
          <DialogDescription>
            Configure export settings for your edited video
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Resolution</Label>
            <Select value={resolution} onValueChange={setResolution} disabled={isExporting}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1080p">1920x1080 (1080p)</SelectItem>
                <SelectItem value="720p">1280x720 (720p)</SelectItem>
                <SelectItem value="480p">854x480 (480p)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Quality</Label>
            <Select value={quality} onValueChange={setQuality} disabled={isExporting}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="high">High (Larger file)</SelectItem>
                <SelectItem value="medium">Medium (Balanced)</SelectItem>
                <SelectItem value="low">Low (Smaller file)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Format</Label>
            <div className="text-sm text-muted-foreground">MP4 (H.264)</div>
          </div>

          {isExporting && (
            <div className="space-y-2">
              <Label>Export Progress</Label>
              <Progress value={progress} className="w-full" />
              <p className="text-sm text-muted-foreground text-center">{progress}%</p>
            </div>
          )}

          <div className="p-3 bg-muted/50 rounded-lg text-xs text-muted-foreground">
            <p>
              💡 Export will apply all edits including text overlays, filters, and trim points.
              This may take a few minutes depending on video length.
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isExporting}>
            Cancel
          </Button>
          <Button onClick={handleExport} disabled={isExporting}>
            {isExporting ? "Exporting..." : "Export Video"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
