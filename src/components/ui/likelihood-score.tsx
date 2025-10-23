import { Badge } from "@/components/ui/badge";
import { Flame, TrendingUp, MinusCircle, Snowflake, Droplet } from "lucide-react";
import { cn } from "@/lib/utils";

interface LikelihoodScoreProps {
  score?: number | null;
  category?: string | null;
  showLabel?: boolean;
  className?: string;
}

export const LikelihoodScore = ({ 
  score, 
  category, 
  showLabel = true,
  className 
}: LikelihoodScoreProps) => {
  if (score === null || score === undefined) return null;

  const getScoreConfig = (scoreValue: number) => {
    if (scoreValue >= 80) {
      return {
        category: 'Hot',
        color: 'bg-red-500/20 text-red-700 dark:text-red-300 border-red-500/30',
        icon: Flame
      };
    } else if (scoreValue >= 60) {
      return {
        category: 'Warm',
        color: 'bg-orange-500/20 text-orange-700 dark:text-orange-300 border-orange-500/30',
        icon: TrendingUp
      };
    } else if (scoreValue >= 40) {
      return {
        category: 'Neutral',
        color: 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-300 border-yellow-500/30',
        icon: MinusCircle
      };
    } else if (scoreValue >= 20) {
      return {
        category: 'Cold',
        color: 'bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-500/30',
        icon: Droplet
      };
    } else {
      return {
        category: 'Frozen',
        color: 'bg-gray-500/20 text-gray-700 dark:text-gray-300 border-gray-500/30',
        icon: Snowflake
      };
    }
  };

  const config = getScoreConfig(score);
  const Icon = config.icon;

  return (
    <Badge 
      variant="outline" 
      className={cn(config.color, 'font-medium', className)}
    >
      <Icon className="w-3 h-3 mr-1" />
      {showLabel ? `${config.category} (${score})` : score}
    </Badge>
  );
};
