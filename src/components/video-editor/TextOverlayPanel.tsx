import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Trash2 } from "lucide-react";
import { TextLayer } from "@/pages/content-studio/VideoEditor";

interface TextOverlayPanelProps {
  textLayers: TextLayer[];
  currentTime: number;
  onAddLayer: () => void;
  onUpdateLayer: (id: string, updates: Partial<TextLayer>) => void;
  onDeleteLayer: (id: string) => void;
}

export const TextOverlayPanel = ({
  textLayers,
  currentTime,
  onAddLayer,
  onUpdateLayer,
  onDeleteLayer,
}: TextOverlayPanelProps) => {
  const activeLayer = textLayers.find(
    (layer) => currentTime >= layer.startTime && currentTime <= layer.endTime
  );

  return (
    <div className="space-y-4">
      <Button onClick={onAddLayer} className="w-full">
        <Plus className="h-4 w-4 mr-2" />
        Add Text Layer
      </Button>

      <ScrollArea className="h-[500px]">
        <div className="space-y-4 pr-4">
          {textLayers.map((layer) => {
            const isActive = layer.id === activeLayer?.id;
            
            return (
              <div
                key={layer.id}
                className={`p-4 border rounded-lg space-y-3 ${
                  isActive ? 'border-primary bg-primary/5' : 'border-border'
                }`}
              >
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">
                    {isActive ? '● Active Layer' : 'Layer'}
                  </Label>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onDeleteLayer(layer.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                <div className="space-y-2">
                  <Label>Text</Label>
                  <Textarea
                    value={layer.text}
                    onChange={(e) => onUpdateLayer(layer.id, { text: e.target.value })}
                    rows={2}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-2">
                    <Label>Start (s)</Label>
                    <Input
                      type="number"
                      value={layer.startTime}
                      onChange={(e) =>
                        onUpdateLayer(layer.id, { startTime: parseFloat(e.target.value) })
                      }
                      step={0.1}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>End (s)</Label>
                    <Input
                      type="number"
                      value={layer.endTime}
                      onChange={(e) =>
                        onUpdateLayer(layer.id, { endTime: parseFloat(e.target.value) })
                      }
                      step={0.1}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Font Size</Label>
                  <Input
                    type="number"
                    value={layer.style.fontSize}
                    onChange={(e) =>
                      onUpdateLayer(layer.id, {
                        style: { ...layer.style, fontSize: parseInt(e.target.value) },
                      })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label>Text Color</Label>
                  <Input
                    type="color"
                    value={layer.style.color}
                    onChange={(e) =>
                      onUpdateLayer(layer.id, {
                        style: { ...layer.style, color: e.target.value },
                      })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label>Animation</Label>
                  <Select
                    value={layer.animation}
                    onValueChange={(value: any) =>
                      onUpdateLayer(layer.id, { animation: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="fade">Fade In/Out</SelectItem>
                      <SelectItem value="slide">Slide In</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-2">
                    <Label>X Position %</Label>
                    <Input
                      type="number"
                      value={layer.position.x}
                      onChange={(e) =>
                        onUpdateLayer(layer.id, {
                          position: { ...layer.position, x: parseFloat(e.target.value) },
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Y Position %</Label>
                    <Input
                      type="number"
                      value={layer.position.y}
                      onChange={(e) =>
                        onUpdateLayer(layer.id, {
                          position: { ...layer.position, y: parseFloat(e.target.value) },
                        })
                      }
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
};
