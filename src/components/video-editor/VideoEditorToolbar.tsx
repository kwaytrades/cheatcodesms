import { Button } from "@/components/ui/button";
import { Download, Upload, Type, Image, Scissors } from "lucide-react";
import { VideoClip } from "@/pages/content-studio/VideoEditor";

interface VideoEditorToolbarProps {
  onExport: () => void;
  isExporting: boolean;
  clips: VideoClip[];
}

export const VideoEditorToolbar = ({ onExport, isExporting, clips }: VideoEditorToolbarProps) => {
  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" disabled>
        <Upload className="h-4 w-4 mr-2" />
        Import
      </Button>
      <Button variant="outline" size="sm" disabled>
        <Type className="h-4 w-4 mr-2" />
        Text
      </Button>
      <Button variant="outline" size="sm" disabled>
        <Image className="h-4 w-4 mr-2" />
        Image
      </Button>
      <Button variant="outline" size="sm" disabled>
        <Scissors className="h-4 w-4 mr-2" />
        Split
      </Button>
      <div className="w-px h-6 bg-border mx-2" />
      <Button 
        onClick={onExport} 
        disabled={isExporting || clips.length === 0}
        size="sm"
      >
        <Download className="h-4 w-4 mr-2" />
        {isExporting ? "Exporting..." : "Export"}
      </Button>
    </div>
  );
};
