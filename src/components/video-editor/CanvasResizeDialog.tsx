import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CanvasSize } from "@/pages/content-studio/VideoEditor";
import { toast } from "sonner";

interface CanvasResizeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentCanvas: CanvasSize;
  onCanvasChange: (canvas: CanvasSize) => void;
}

const canvasPresets: CanvasSize[] = [
  { width: 1920, height: 1080, aspectRatio: '16:9', name: 'YouTube (1080p)' },
  { width: 3840, height: 2160, aspectRatio: '16:9', name: 'YouTube (4K)' },
  { width: 1080, height: 1920, aspectRatio: '9:16', name: 'YouTube Shorts' },
  { width: 1080, height: 1080, aspectRatio: '1:1', name: 'Instagram Feed (Square)' },
  { width: 1080, height: 1350, aspectRatio: '4:5', name: 'Instagram Feed (Portrait)' },
  { width: 1080, height: 1920, aspectRatio: '9:16', name: 'Instagram Reels' },
  { width: 1080, height: 1920, aspectRatio: '9:16', name: 'Instagram Story' },
  { width: 1080, height: 1920, aspectRatio: '9:16', name: 'TikTok' },
  { width: 1280, height: 720, aspectRatio: '16:9', name: 'Facebook Feed' },
  { width: 1920, height: 1080, aspectRatio: '16:9', name: 'LinkedIn' },
  { width: 1280, height: 720, aspectRatio: '16:9', name: 'Twitter/X' },
];

export const CanvasResizeDialog = ({
  open,
  onOpenChange,
  currentCanvas,
  onCanvasChange,
}: CanvasResizeDialogProps) => {
  const [selectedCanvas, setSelectedCanvas] = useState<CanvasSize>(currentCanvas);

  const handleApply = () => {
    onCanvasChange(selectedCanvas);
    onOpenChange(false);
    toast.success(`Canvas changed to ${selectedCanvas.name}`);
  };

  const getIcon = (name: string) => {
    if (name.includes('YouTube') && !name.includes('Shorts')) return '🎥';
    if (name.includes('Shorts')) return '📱';
    if (name.includes('Instagram')) {
      if (name.includes('Square')) return '📷';
      if (name.includes('Reels')) return '🎬';
      if (name.includes('Story')) return '⭕';
      return '📷';
    }
    if (name.includes('TikTok')) return '🎵';
    if (name.includes('Facebook')) return '👍';
    if (name.includes('LinkedIn')) return '💼';
    if (name.includes('Twitter') || name.includes('X')) return '🐦';
    return '📐';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Canvas Size & Templates</DialogTitle>
          <DialogDescription>
            Choose a preset template for different social media platforms
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[400px] pr-4">
          <div className="grid grid-cols-2 gap-3">
            {canvasPresets.map((preset) => (
              <button
                key={preset.name}
                onClick={() => setSelectedCanvas(preset)}
                className={`flex flex-col items-start p-4 rounded-lg border-2 transition-all hover:border-primary/50 text-left ${
                  selectedCanvas.name === preset.name
                    ? 'border-primary bg-primary/5'
                    : 'border-border'
                }`}
              >
                <div className="flex items-start gap-3 w-full">
                  <span className="text-2xl">{getIcon(preset.name)}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm mb-1">{preset.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {preset.width} × {preset.height}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {preset.aspectRatio}
                    </div>
                  </div>
                </div>
                
                {/* Visual Preview */}
                <div className="mt-3 w-full flex items-center justify-center">
                  <div
                    className="border-2 border-muted-foreground/30 bg-muted/50"
                    style={{
                      width: preset.aspectRatio === '16:9' ? '80px' : 
                             preset.aspectRatio === '9:16' ? '40px' : 
                             preset.aspectRatio === '4:5' ? '50px' : '60px',
                      height: preset.aspectRatio === '16:9' ? '45px' : 
                              preset.aspectRatio === '9:16' ? '71px' : 
                              preset.aspectRatio === '4:5' ? '62px' : '60px',
                    }}
                  />
                </div>
              </button>
            ))}
          </div>
        </ScrollArea>

        <div className="flex items-center justify-between pt-4 border-t">
          <div className="text-sm text-muted-foreground">
            Current: {currentCanvas.name} ({currentCanvas.aspectRatio})
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleApply}>
              Apply Canvas
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
