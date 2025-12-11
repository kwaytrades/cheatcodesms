import { Bot, User, Video, Book, Layers, TrendingUp, Award, Sparkles, UserPlus, Headphones, Megaphone, LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect, useRef } from "react";

interface Message {
  id: string;
  body: string;
  created_at: string;
  direction: string;
  sender: string;
  agent_type?: string;
}

interface SMSChatViewProps {
  messages: Message[];
  activeAgentType?: string | null;
  isTyping?: boolean;
}

const AGENT_CONFIG: Record<string, { Icon: LucideIcon; color: string; bgColor: string; name: string }> = {
  sales_agent: { Icon: UserPlus, color: "text-cyan-500", bgColor: "bg-cyan-500/10", name: "Sam" },
  customer_service: { Icon: Headphones, color: "text-pink-500", bgColor: "bg-pink-500/10", name: "Casey" },
  webinar: { Icon: Video, color: "text-blue-500", bgColor: "bg-blue-500/10", name: "Wendi" },
  textbook: { Icon: Book, color: "text-orange-500", bgColor: "bg-orange-500/10", name: "Thomas" },
  flashcards: { Icon: Layers, color: "text-purple-500", bgColor: "bg-purple-500/10", name: "Frank" },
  algo_monthly: { Icon: TrendingUp, color: "text-green-500", bgColor: "bg-green-500/10", name: "Adam" },
  ccta: { Icon: Award, color: "text-yellow-500", bgColor: "bg-yellow-500/10", name: "Chris" },
  lead_nurture: { Icon: Sparkles, color: "text-gray-500", bgColor: "bg-gray-500/10", name: "Jamie" },
  influencer_outreach: { Icon: Megaphone, color: "text-purple-400", bgColor: "bg-purple-400/10", name: "Influencer" },
};

const TypingIndicator = ({ agentType }: { agentType?: string | null }) => {
  const config = agentType ? AGENT_CONFIG[agentType] : AGENT_CONFIG.customer_service;
  const Icon = config?.Icon || Bot;
  
  return (
    <div className="flex gap-3">
      <div className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
        config?.bgColor || "bg-primary/10"
      )}>
        <Icon className={cn("h-4 w-4", config?.color || "text-primary")} />
      </div>
      <div className="flex items-center gap-1 px-4 py-2 bg-muted rounded-lg">
        <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
        <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
        <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
    </div>
  );
};

export const SMSChatView = ({ messages, activeAgentType, isTyping = false }: SMSChatViewProps) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive or typing status changes
  useEffect(() => {
    setTimeout(() => {
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
      }
    }, 50);
  }, [messages, isTyping]);

  if (messages.length === 0 && !isTyping) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        No messages yet
      </div>
    );
  }

  // Sort messages by created_at to ensure correct order (oldest first, newest at bottom)
  // Use secondary sort by ID for stability when timestamps are equal
  const sortedMessages = [...messages].sort((a, b) => {
    const timeA = new Date(a.created_at).getTime();
    const timeB = new Date(b.created_at).getTime();
    if (timeA !== timeB) return timeA - timeB;
    // Secondary sort: user messages before AI responses at same timestamp
    if (a.direction !== b.direction) {
      return a.direction === 'outbound' ? -1 : 1;
    }
    return a.id.localeCompare(b.id);
  });

  return (
    <div 
      ref={scrollContainerRef}
      className="h-[calc(100vh-300px)] overflow-y-auto"
    >
      <div className="space-y-4 p-4">
        {sortedMessages.map((message) => {
          const isInbound = message.direction === "inbound";
          const isAI = message.sender.startsWith("ai_");
          
          // Use message-specific agent_type, fallback to activeAgentType
          const messageAgentType = message.agent_type || activeAgentType || 'customer_service';
          const agentConfig = isAI ? AGENT_CONFIG[messageAgentType] || AGENT_CONFIG.customer_service : null;
          const AgentIcon = agentConfig?.Icon || Bot;
          
          return (
            <div
              key={message.id}
              className={cn(
                "flex gap-3 animate-fade-in",
                !isInbound && "flex-row-reverse"
              )}
            >
              <div className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                isInbound 
                  ? "bg-muted" 
                  : isAI 
                    ? agentConfig?.bgColor || "bg-primary/10"
                    : "bg-primary"
              )}>
                {isInbound ? (
                  <User className="h-4 w-4" />
                ) : isAI ? (
                  <AgentIcon className={cn("h-4 w-4", agentConfig?.color || "text-primary")} />
                ) : (
                  <User className="h-4 w-4 text-primary-foreground" />
                )}
              </div>
              
              <div className={cn(
                "flex flex-col gap-1 max-w-[70%]",
                !isInbound && "items-end"
              )}>
                <div className={cn(
                  "rounded-lg px-3 py-2 text-sm",
                  isInbound
                    ? "bg-muted"
                    : "bg-primary text-primary-foreground"
                )}>
                  {message.body}
                </div>
                <div className="text-xs text-muted-foreground">
                  {new Date(message.created_at).toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true
                  })}
                  {!isInbound && ` (${isAI ? agentConfig?.name || 'AI' : 'You'})`}
                </div>
              </div>
            </div>
          );
        })}
        
        {isTyping && <TypingIndicator agentType={activeAgentType} />}
      </div>
    </div>
  );
};
