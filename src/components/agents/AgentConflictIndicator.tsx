import { Badge } from "@/components/ui/badge";
import { Clock, Zap } from "lucide-react";

interface AgentConflictIndicatorProps {
  isActive: boolean;
  queuePosition?: number;
}

export function AgentConflictIndicator({ isActive, queuePosition }: AgentConflictIndicatorProps) {
  if (isActive) {
    return (
      <Badge variant="default" className="gap-1">
        <Zap className="h-3 w-3" />
        Currently Active
      </Badge>
    );
  }

  if (queuePosition !== undefined) {
    return (
      <Badge variant="secondary" className="gap-1">
        <Clock className="h-3 w-3" />
        Queued (Position {queuePosition})
      </Badge>
    );
  }

  return null;
}
