import { Badge } from "@/components/ui/badge";
import { CheckCircle, Clock, XCircle, Pause } from "lucide-react";

interface AgentStatusBadgeProps {
  status: string;
}

export function AgentStatusBadge({ status }: AgentStatusBadgeProps) {
  const config = {
    active: {
      label: "Active",
      icon: CheckCircle,
      className: "bg-green-500/20 text-green-700 dark:text-green-300 border-green-500/30",
    },
    expired: {
      label: "Expired",
      icon: Clock,
      className: "bg-gray-500/20 text-gray-700 dark:text-gray-300 border-gray-500/30",
    },
    converted: {
      label: "Converted",
      icon: CheckCircle,
      className: "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
    },
    churned: {
      label: "Churned",
      icon: XCircle,
      className: "bg-red-500/20 text-red-700 dark:text-red-300 border-red-500/30",
    },
    paused: {
      label: "Paused",
      icon: Pause,
      className: "bg-yellow-500/20 text-yellow-700 dark:text-yellow-300 border-yellow-500/30",
    },
  };

  const statusConfig = config[status as keyof typeof config] || config.active;
  const Icon = statusConfig.icon;

  return (
    <Badge variant="outline" className={statusConfig.className}>
      <Icon className="w-3 h-3 mr-1" />
      {statusConfig.label}
    </Badge>
  );
}
