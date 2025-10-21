import { Button } from "@/components/ui/button";
import { Download, Upload, Type, Image, Scissors } from "lucide-react";
import { VideoClip } from "@/pages/content-studio/VideoEditor";
import { useRef } from "react";
import { toast } from "sonner";

interface VideoEditorToolbarProps {
  onExport: () => void;
  isExporting: boolean;
  hasClips: boolean;
  onImportVideo?: (file: File) => void;
  onAddText?: () => void;
  onAddImage?: () => void;
  onSplit?: () => void;
  selectedFormat?: string;
  onFormatChange?: (format: any) => void;
}

export const VideoEditorToolbar = ({ 
  onExport, 
  isExporting, 
  hasClips,
  onImportVideo,
  onAddText,
  onAddImage,
  onSplit,
}: VideoEditorToolbarProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type.startsWith('video/')) {
        onImportVideo?.(file);
      } else {
        toast.error("Please select a video file");
      }
    }
  };

  return (
    <div className="flex items-center gap-2">
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*"
        onChange={handleFileChange}
        className="hidden"
      />
      <Button variant="outline" size="sm" onClick={handleImportClick}>
        <Upload className="h-4 w-4 mr-2" />
        Import
      </Button>
      <Button variant="outline" size="sm" onClick={onAddText}>
        <Type className="h-4 w-4 mr-2" />
        Text
      </Button>
      <Button variant="outline" size="sm" onClick={onAddImage}>
        <Image className="h-4 w-4 mr-2" />
        Image
      </Button>
      <Button 
        variant="outline" 
        size="sm" 
        onClick={onSplit}
        disabled={!hasClips}
      >
        <Scissors className="h-4 w-4 mr-2" />
        Split
      </Button>
      <div className="w-px h-6 bg-border mx-2" />
      <Button 
        onClick={onExport} 
        disabled={isExporting || !hasClips}
        size="sm"
      >
        <Download className="h-4 w-4 mr-2" />
        {isExporting ? "Exporting..." : "Export"}
      </Button>
    </div>
  );
};
