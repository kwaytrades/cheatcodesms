import { Video, Book, Layers, TrendingUp, Award, Sparkles, UserPlus, Headphones, Megaphone } from "lucide-react";

interface AgentTypeIconProps {
  type: string;
  className?: string;
}

export function AgentTypeIcon({ type, className = "w-5 h-5" }: AgentTypeIconProps) {
  const icons = {
    sales_agent: { Icon: UserPlus, color: "text-cyan-500" },
    customer_service: { Icon: Headphones, color: "text-pink-500" },
    webinar: { Icon: Video, color: "text-blue-500" },
    textbook: { Icon: Book, color: "text-orange-500" },
    flashcards: { Icon: Layers, color: "text-purple-500" },
    algo_monthly: { Icon: TrendingUp, color: "text-green-500" },
    ccta: { Icon: Award, color: "text-yellow-500" },
    lead_nurture: { Icon: Sparkles, color: "text-gray-500" },
    influencer_outreach: { Icon: Megaphone, color: "text-purple-400" },
  };

  const config = icons[type as keyof typeof icons] || icons.lead_nurture;
  const Icon = config.Icon;

  return <Icon className={`${className} ${config.color}`} />;
}
