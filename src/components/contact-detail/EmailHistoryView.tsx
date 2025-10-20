import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Mail, CheckCheck } from "lucide-react";

interface AIMessage {
  id: string;
  subject?: string;
  message_body: string;
  sent_at: string;
  opened: boolean;
  replied: boolean;
  opened_at?: string;
}

interface EmailHistoryViewProps {
  emails: AIMessage[];
}

export const EmailHistoryView = ({ emails }: EmailHistoryViewProps) => {
  if (emails.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        No emails sent yet
      </div>
    );
  }

  return (
    <ScrollArea className="h-[calc(100vh-300px)]">
      <div className="space-y-3 p-4">
        {emails.map((email) => (
          <Card key={email.id} className="p-4 hover:bg-muted/50 cursor-pointer transition-colors">
            <div className="flex items-start justify-between gap-3">
              <div className="flex gap-3 flex-1 min-w-0">
                <Mail className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm mb-1 truncate">
                    {email.subject || "No Subject"}
                  </div>
                  <div className="text-sm text-muted-foreground line-clamp-2 mb-2">
                    {email.message_body}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>
                      {new Date(email.sent_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit'
                      })}
                    </span>
                    {email.opened && (
                      <Badge variant="secondary" className="text-xs">
                        <CheckCheck className="h-3 w-3 mr-1" />
                        Opened
                      </Badge>
                    )}
                    {email.replied && (
                      <Badge variant="default" className="text-xs">
                        Replied
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </ScrollArea>
  );
};
