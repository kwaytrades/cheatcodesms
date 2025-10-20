import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageSquare, Mail, ShoppingCart, UserPlus } from "lucide-react";

interface TimelineEvent {
  id: string;
  type: "message" | "email" | "purchase" | "status_change";
  title: string;
  description?: string;
  timestamp: string;
  metadata?: any;
}

interface TimelineViewProps {
  events: TimelineEvent[];
}

export const TimelineView = ({ events }: TimelineViewProps) => {
  if (events.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        No activity yet
      </div>
    );
  }

  const getIcon = (type: string) => {
    switch (type) {
      case "message": return <MessageSquare className="h-4 w-4" />;
      case "email": return <Mail className="h-4 w-4" />;
      case "purchase": return <ShoppingCart className="h-4 w-4" />;
      default: return <UserPlus className="h-4 w-4" />;
    }
  };

  return (
    <ScrollArea className="h-[calc(100vh-300px)]">
      <div className="p-4">
        <div className="space-y-4">
          {events.map((event, idx) => (
            <div key={event.id} className="flex gap-3">
              <div className="relative">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                  {getIcon(event.type)}
                </div>
                {idx < events.length - 1 && (
                  <div className="absolute left-4 top-8 bottom-0 w-px bg-border -mb-4" />
                )}
              </div>
              
              <div className="flex-1 pb-4">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <span className="font-medium text-sm">{event.title}</span>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(event.timestamp).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit'
                    })}
                  </span>
                </div>
                {event.description && (
                  <p className="text-sm text-muted-foreground">{event.description}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </ScrollArea>
  );
};
