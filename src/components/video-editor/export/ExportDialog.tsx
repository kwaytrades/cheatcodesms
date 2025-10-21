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

  const handleExport = async () => {
    setExporting(true);
    setProgress(0);

    try {
      await onExport();
      
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

  // Use current progress from parent if available
  const displayProgress = exporting ? (currentProgress || progress) : 0;

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
              <Progress value={displayProgress} />
              <p className="text-sm text-center text-muted-foreground">
                {displayProgress < 50 ? "Capturing frames..." : displayProgress < 90 ? "Encoding video..." : "Finalizing..."} {displayProgress}%
              </p>
            </>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Your video will be rendered with all overlays and effects applied.
              </p>
              <p className="text-sm text-muted-foreground font-medium">
                Export settings: High quality MP4 (CRF 18)
              </p>
            </div>
          )}
        </div>

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
