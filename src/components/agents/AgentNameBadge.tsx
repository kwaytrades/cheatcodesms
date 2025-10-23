import { Badge } from "@/components/ui/badge";
import { AgentTypeIcon } from "./AgentTypeIcon";

const AGENT_NAMES: Record<string, string> = {
  webinar: "Wendi",
  textbook: "Thomas",
  flashcards: "Frank",
  algo_monthly: "Adam",
  ccta: "Chris",
  lead_nurture: "Jamie",
  sales_agent: "Sam",
  customer_service: "Casey",
};

interface AgentNameBadgeProps {
  agentType: string;
  className?: string;
}

export function AgentNameBadge({ agentType, className }: AgentNameBadgeProps) {
  const name = AGENT_NAMES[agentType] || "Agent";
  
  return (
    <Badge variant="outline" className={`gap-2 ${className}`}>
      <AgentTypeIcon type={agentType} className="h-3 w-3" />
      {name}
    </Badge>
  );
}
