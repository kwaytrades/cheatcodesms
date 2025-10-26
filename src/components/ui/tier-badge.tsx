import { Badge } from "@/components/ui/badge";
import { Shield, AlertTriangle, Crown } from "lucide-react";
import { cn } from "@/lib/utils";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";

interface TierBadgeProps {
  tier?: string | null;
  className?: string;
  showIcon?: boolean;
  disputedAmount?: number;
  hasDisputed?: boolean;
  onShitlistClick?: () => void;
}

export const TierBadge = ({ 
  tier, 
  className, 
  showIcon = true,
  disputedAmount = 0,
  hasDisputed = false,
  onShitlistClick
}: TierBadgeProps) => {
  if (!tier) return null;

  const getTierConfig = (tierValue: string) => {
    switch (tierValue.toUpperCase()) {
      case 'SHITLIST':
        return {
          label: 'SHITLIST',
          color: 'bg-black text-white border-red-600',
          glow: 'glow-red',
          icon: AlertTriangle
        };
      case 'LEAD':
        return {
          label: 'Lead',
          color: 'bg-gray-700 text-gray-100 border-gray-600',
          glow: 'glow-blue',
          icon: null
        };
      case 'LEVEL 1':
        return {
          label: 'Level 1',
          color: 'bg-blue-600 text-white border-blue-500 font-semibold',
          glow: 'glow-blue',
          icon: null
        };
      case 'LEVEL 2':
        return {
          label: 'Level 2',
          color: 'bg-teal-500 text-white border-teal-400 font-semibold',
          glow: 'glow-teal',
          icon: null
        };
      case 'LEVEL 3':
        return {
          label: 'Level 3',
          color: 'bg-green-500 text-black border-green-400 font-bold',
          glow: 'glow-green',
          icon: Shield
        };
      case 'VIP':
        return {
          label: 'VIP',
          color: 'bg-yellow-400 text-black border-yellow-300 font-extrabold',
          glow: 'glow-gold',
          icon: Crown
        };
      default:
        return {
          label: tierValue,
          color: 'bg-gray-700 text-gray-100 border-gray-600',
          glow: 'glow-blue',
          icon: null
        };
    }
  };

  const config = getTierConfig(tier);
  const Icon = config.icon;

  // Special handling for SHITLIST tier
  if (tier.toUpperCase() === 'SHITLIST') {
    return (
      <HoverCard>
        <HoverCardTrigger asChild>
          <Badge 
            variant="outline" 
            className={cn(config.color, config.glow, 'font-medium cursor-pointer hover:opacity-80 transition-opacity', className)}
            onClick={onShitlistClick}
          >
            {showIcon && Icon && <Icon className="w-3 h-3 mr-1" />}
            {config.label}
          </Badge>
        </HoverCardTrigger>
        <HoverCardContent className="w-80">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <h4 className="font-semibold text-sm text-destructive">High Risk Contact</h4>
            </div>
            <p className="text-xs text-muted-foreground">
              This contact has disputed charges totaling <span className="font-bold text-destructive">${disputedAmount.toLocaleString()}</span>.
            </p>
            <p className="text-xs text-muted-foreground">
              Status: <span className="font-medium">{hasDisputed ? "Active Dispute" : "Resolved"}</span>
            </p>
            <p className="text-xs text-muted-foreground italic mt-2">
              Click for full details
            </p>
          </div>
        </HoverCardContent>
      </HoverCard>
    );
  }

  return (
    <Badge 
      variant="outline" 
      className={cn(config.color, config.glow, 'font-medium', className)}
    >
      {showIcon && Icon && <Icon className="w-3 h-3 mr-1" />}
      {config.label}
    </Badge>
  );
};
