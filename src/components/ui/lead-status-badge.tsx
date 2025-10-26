import { Badge } from "@/components/ui/badge";
import { Flame, TrendingUp, Users, Droplet, DollarSign } from "lucide-react";
import { cn } from "@/lib/utils";

interface LeadStatusBadgeProps {
  score?: number | null;
  status?: string | null;
  showLabel?: boolean;
  className?: string;
}

export const LeadStatusBadge = ({ 
  score, 
  status, 
  showLabel = true,
  className 
}: LeadStatusBadgeProps) => {
  if (score === null || score === undefined) return null;

  const getScoreConfig = (scoreValue: number) => {
    if (scoreValue >= 80) {
      return {
        label: 'READY',
        color: 'bg-green-500/20 text-green-700 dark:text-green-300 border-green-500/30',
        glow: 'glow-green',
        icon: DollarSign
      };
    } else if (scoreValue >= 70) {
      return {
        label: 'Hot',
        color: 'bg-red-500/20 text-red-700 dark:text-red-300 border-red-500/30',
        glow: 'glow-red',
        icon: Flame
      };
    } else if (scoreValue >= 50) {
      return {
        label: 'Warm',
        color: 'bg-orange-500/20 text-orange-700 dark:text-orange-300 border-orange-500/30',
        glow: 'glow-orange',
        icon: TrendingUp
      };
    } else if (scoreValue >= 30) {
      return {
        label: 'Nurture',
        color: 'bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 border-cyan-500/30',
        glow: 'glow-cyan',
        icon: Users
      };
    } else {
      return {
        label: 'Cold Lead',
        color: 'bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-500/30',
        glow: 'glow-blue',
        icon: Droplet
      };
    }
  };

  const config = getScoreConfig(score);
  const Icon = config.icon;

  return (
    <Badge 
      variant="outline" 
      className={cn(config.color, config.glow, 'font-medium', className)}
    >
      <Icon className="w-3 h-3 mr-1" />
      {showLabel ? config.label : status || config.label}
    </Badge>
  );
};
