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
        color: 'bg-[hsl(120,100%,50%)] text-black border-[hsl(120,100%,40%)] font-bold',
        glow: 'glow-green',
        icon: DollarSign
      };
    } else if (scoreValue >= 70) {
      return {
        label: 'Hot',
        color: 'bg-[hsl(0,100%,60%)] text-white border-[hsl(0,100%,50%)] font-semibold',
        glow: 'glow-red',
        icon: Flame
      };
    } else if (scoreValue >= 50) {
      return {
        label: 'Warm',
        color: 'bg-[hsl(30,100%,55%)] text-black border-[hsl(30,100%,45%)] font-semibold',
        glow: 'glow-orange',
        icon: TrendingUp
      };
    } else if (scoreValue >= 30) {
      return {
        label: 'Nurture',
        color: 'bg-[hsl(180,100%,45%)] text-black border-[hsl(180,100%,35%)] font-semibold',
        glow: 'glow-cyan',
        icon: Users
      };
    } else {
      return {
        label: 'Cold Lead',
        color: 'bg-[hsl(210,100%,55%)] text-white border-[hsl(210,100%,45%)] font-semibold',
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
