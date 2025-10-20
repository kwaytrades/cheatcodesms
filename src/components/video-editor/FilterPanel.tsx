import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { VideoFilters } from "@/pages/content-studio/VideoEditor";

interface FilterPanelProps {
  filters: VideoFilters;
  onFiltersChange: (filters: VideoFilters) => void;
}

const PRESETS = {
  none: { brightness: 100, contrast: 100, saturation: 100, temperature: 0 },
  warm: { brightness: 105, contrast: 105, saturation: 110, temperature: 10 },
  cool: { brightness: 100, contrast: 105, saturation: 95, temperature: -10 },
  vintage: { brightness: 95, contrast: 110, saturation: 85, temperature: 15 },
  bw: { brightness: 100, contrast: 120, saturation: 0, temperature: 0 },
  vivid: { brightness: 105, contrast: 115, saturation: 130, temperature: 0 },
};

export const FilterPanel = ({ filters, onFiltersChange }: FilterPanelProps) => {
  const applyPreset = (presetName: keyof typeof PRESETS) => {
    onFiltersChange({ ...PRESETS[presetName], preset: presetName });
  };

  const resetFilters = () => {
    onFiltersChange(PRESETS.none);
  };

  return (
    <div className="space-y-6">
      {/* Presets */}
      <div className="space-y-2">
        <Label>Filter Presets</Label>
        <div className="grid grid-cols-2 gap-2">
          {Object.keys(PRESETS).map((preset) => (
            <Button
              key={preset}
              variant={filters.preset === preset ? "default" : "outline"}
              size="sm"
              onClick={() => applyPreset(preset as keyof typeof PRESETS)}
            >
              {preset.charAt(0).toUpperCase() + preset.slice(1)}
            </Button>
          ))}
        </div>
      </div>

      {/* Manual Controls */}
      <div className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between">
            <Label>Brightness</Label>
            <span className="text-sm text-muted-foreground">{filters.brightness}%</span>
          </div>
          <Slider
            value={[filters.brightness]}
            min={0}
            max={200}
            step={1}
            onValueChange={([value]) =>
              onFiltersChange({ ...filters, brightness: value, preset: undefined })
            }
          />
        </div>

        <div className="space-y-2">
          <div className="flex justify-between">
            <Label>Contrast</Label>
            <span className="text-sm text-muted-foreground">{filters.contrast}%</span>
          </div>
          <Slider
            value={[filters.contrast]}
            min={0}
            max={200}
            step={1}
            onValueChange={([value]) =>
              onFiltersChange({ ...filters, contrast: value, preset: undefined })
            }
          />
        </div>

        <div className="space-y-2">
          <div className="flex justify-between">
            <Label>Saturation</Label>
            <span className="text-sm text-muted-foreground">{filters.saturation}%</span>
          </div>
          <Slider
            value={[filters.saturation]}
            min={0}
            max={200}
            step={1}
            onValueChange={([value]) =>
              onFiltersChange({ ...filters, saturation: value, preset: undefined })
            }
          />
        </div>

        <div className="space-y-2">
          <div className="flex justify-between">
            <Label>Temperature</Label>
            <span className="text-sm text-muted-foreground">{filters.temperature}°</span>
          </div>
          <Slider
            value={[filters.temperature]}
            min={-50}
            max={50}
            step={1}
            onValueChange={([value]) =>
              onFiltersChange({ ...filters, temperature: value, preset: undefined })
            }
          />
        </div>

        <Button variant="outline" size="sm" onClick={resetFilters} className="w-full">
          Reset Filters
        </Button>
      </div>

      <div className="p-3 bg-muted/50 rounded-lg text-xs text-muted-foreground">
        <p>💡 Adjust filters to enhance your video's visual appeal. Use presets for quick styling.</p>
      </div>
    </div>
  );
};
