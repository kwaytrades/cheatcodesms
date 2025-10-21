import React from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { AspectRatio as AspectRatioType } from "@/lib/video-editor/types";
import { Monitor, Square, Instagram, Smartphone } from "lucide-react";

interface AspectRatioSelectorProps {
  currentRatio: AspectRatioType;
  onRatioChange: (ratio: AspectRatioType) => void;
}

const ASPECT_RATIOS = [
  { value: "16:9" as AspectRatioType, label: "YouTube / Landscape", icon: Monitor, dimensions: "1920×1080" },
  { value: "1:1" as AspectRatioType, label: "Instagram / Square", icon: Square, dimensions: "1080×1080" },
  { value: "4:5" as AspectRatioType, label: "Instagram / Portrait", icon: Instagram, dimensions: "1080×1350" },
  { value: "9:16" as AspectRatioType, label: "TikTok / Stories", icon: Smartphone, dimensions: "1080×1920" },
];

export const AspectRatioSelector: React.FC<AspectRatioSelectorProps> = ({
  currentRatio,
  onRatioChange,
}) => {
  const current = ASPECT_RATIOS.find((r) => r.value === currentRatio);
  const Icon = current?.icon || Monitor;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Icon className="h-4 w-4" />
          {current?.value || "16:9"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel>Canvas Aspect Ratio</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {ASPECT_RATIOS.map((ratio) => {
          const RatioIcon = ratio.icon;
          return (
            <DropdownMenuItem
              key={ratio.value}
              onClick={() => onRatioChange(ratio.value)}
              className="flex items-start gap-3 py-2"
            >
              <RatioIcon className="h-4 w-4 mt-0.5" />
              <div className="flex flex-col">
                <span className="font-medium">{ratio.value}</span>
                <span className="text-xs text-muted-foreground">{ratio.label}</span>
                <span className="text-xs text-muted-foreground">{ratio.dimensions}</span>
              </div>
              {currentRatio === ratio.value && (
                <span className="ml-auto text-primary">✓</span>
              )}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
