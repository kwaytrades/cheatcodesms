import { Badge } from "@/components/ui/badge";
import { Shield, AlertTriangle, Crown } from "lucide-react";
import { cn } from "@/lib/utils";

interface TierBadgeProps {
  tier?: string | null;
  className?: string;
  showIcon?: boolean;
}

export const TierBadge = ({ tier, className, showIcon = true }: TierBadgeProps) => {
  if (!tier) return null;

  const getTierConfig = (tierValue: string) => {
    switch (tierValue.toUpperCase()) {
      case 'SHITLIST':
        return {
          label: 'SHITLIST',
          color: 'bg-black text-white border-black',
          icon: AlertTriangle
        };
      case 'LEAD':
        return {
          label: 'Lead',
          color: 'bg-muted text-muted-foreground border-muted',
          icon: null
        };
      case 'LEVEL 1':
        return {
          label: 'Level 1',
          color: 'bg-muted text-muted-foreground border-muted',
          icon: null
        };
      case 'LEVEL 2':
        return {
          label: 'Level 2',
          color: 'bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-500/30',
          icon: null
        };
      case 'LEVEL 3':
        return {
          label: 'Level 3',
          color: 'bg-green-500/20 text-green-700 dark:text-green-300 border-green-500/30',
          icon: Shield
        };
      case 'VIP':
        return {
          label: 'VIP',
          color: 'bg-red-500/20 text-red-700 dark:text-red-300 border-red-500/30',
          icon: Crown
        };
      default:
        return {
          label: tierValue,
          color: 'bg-muted text-muted-foreground border-muted',
          icon: null
        };
    }
  };

  const config = getTierConfig(tier);
  const Icon = config.icon;

  return (
    <Badge 
      variant="outline" 
      className={cn(config.color, 'font-medium', className)}
    >
      {showIcon && Icon && <Icon className="w-3 h-3 mr-1" />}
      {config.label}
    </Badge>
  );
};
