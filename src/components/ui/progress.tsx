import * as React from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";

import { cn } from "@/lib/utils";

const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> & {
    indicatorClassName?: string;
    useGradient?: boolean;
    useSentimentGradient?: boolean;
    isReady?: boolean;
  }
>(({ className, value, indicatorClassName, useGradient = false, useSentimentGradient = false, isReady = false, ...props }, ref) => {
  
  // Calculate color based on score value when using gradient
  const getScoreColor = () => {
    if (!useGradient) return "";
    if (isReady || (value && value >= 80)) {
      return "bg-[hsl(120,100%,50%)] glow-green"; // Bright lime green with glow for READY
    }
    
    const score = value || 0;
    if (score < 30) return "bg-[hsl(210,100%,55%)]"; // Blue - Cold
    if (score < 50) return "bg-[hsl(180,100%,45%)]"; // Cyan - Nurture
    if (score < 70) return "bg-[hsl(30,100%,55%)]";  // Orange - Warm
    return "bg-[hsl(0,100%,60%)]";                    // Red - Hot (70-79)
  };

  return (
    <ProgressPrimitive.Root
      ref={ref}
      className={cn("relative h-4 w-full overflow-hidden rounded-full bg-muted", className)}
      {...props}
    >
      <ProgressPrimitive.Indicator
        className={cn(
          "h-full w-full flex-1 transition-all",
          useSentimentGradient 
            ? "sentiment-gradient" 
            : useGradient 
              ? getScoreColor()
              : "bg-primary",
          indicatorClassName
        )}
        style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
      />
    </ProgressPrimitive.Root>
  );
});
Progress.displayName = ProgressPrimitive.Root.displayName;

export { Progress };
