import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onExport: () => Promise<void>;
}

export const ExportDialog: React.FC<ExportDialogProps> = ({
  open,
  onOpenChange,
  onExport,
}) => {
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleExport = async () => {
    setExporting(true);
    setProgress(0);

    try {
      // Simulate progress
      const interval = setInterval(() => {
        setProgress((prev) => Math.min(prev + 10, 90));
      }, 500);

      await onExport();

      clearInterval(interval);
      setProgress(100);
      toast.success("Video exported successfully!");
      
      setTimeout(() => {
        onOpenChange(false);
        setExporting(false);
        setProgress(0);
      }, 1000);
    } catch (error) {
      toast.error("Export failed. Please try again.");
      setExporting(false);
      setProgress(0);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Export Video</DialogTitle>
          <DialogDescription>
            Export your video composition as an MP4 file
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {exporting ? (
            <>
              <Progress value={progress} />
              <p className="text-sm text-center text-muted-foreground">
                Exporting... {progress}%
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Your video will be rendered with all overlays and effects applied.
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={exporting}>
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
