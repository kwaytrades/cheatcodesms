import { ScrollArea } from "@/components/ui/scroll-area";
import { Bot, User } from "lucide-react";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  body: string;
  created_at: string;
  direction: string;
  sender: string;
}

interface SMSChatViewProps {
  messages: Message[];
}

export const SMSChatView = ({ messages }: SMSChatViewProps) => {
  if (messages.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        No messages yet
      </div>
    );
  }

  return (
    <ScrollArea className="h-[calc(100vh-300px)]">
      <div className="space-y-4 p-4">
        {messages.map((message) => {
          const isInbound = message.direction === "inbound";
          const isAI = message.sender.startsWith("ai_");
          
          return (
            <div
              key={message.id}
              className={cn(
                "flex gap-3",
                !isInbound && "flex-row-reverse"
              )}
            >
              <div className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                isInbound ? "bg-muted" : isAI ? "bg-primary/10" : "bg-primary"
              )}>
                {isInbound ? (
                  <User className="h-4 w-4" />
                ) : isAI ? (
                  <Bot className="h-4 w-4 text-primary" />
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
                  {!isInbound && ` (${isAI ? 'AI' : 'You'})`}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
};
