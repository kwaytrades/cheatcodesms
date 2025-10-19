import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { XCircle, AlertCircle } from "lucide-react";
import { format } from "date-fns";

interface FailedMessage {
  id: string;
  phone_number: string;
  error_message: string | null;
  created_at: string;
  personalized_message: string;
}

interface FailedMessagesDialogProps {
  campaignId: string;
  failedCount: number;
}

export const FailedMessagesDialog = ({ campaignId, failedCount }: FailedMessagesDialogProps) => {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<FailedMessage[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      loadFailedMessages();
    }
  }, [open, campaignId]);

  const loadFailedMessages = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("campaign_messages")
        .select("*")
        .eq("campaign_id", campaignId)
        .eq("status", "failed")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setMessages(data || []);
    } catch (error) {
      console.error("Error loading failed messages:", error);
    } finally {
      setLoading(false);
    }
  };

  if (failedCount === 0) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-auto p-0 text-destructive hover:text-destructive">
          <span className="flex items-center gap-1">
            <XCircle className="h-3 w-3" />
            {failedCount}
          </span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            Failed Messages ({failedCount})
          </DialogTitle>
          <DialogDescription>
            Messages that failed to send and their error reasons
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[500px] pr-4">
          {loading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              Loading...
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <XCircle className="h-12 w-12 mb-2 opacity-50" />
              <p>No failed messages found</p>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className="p-4 border rounded-lg space-y-2 bg-destructive/5 border-destructive/20"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="destructive" className="text-xs">Failed</Badge>
                        <span className="text-sm font-medium">{message.phone_number}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(message.created_at), "MMM d, yyyy 'at' h:mm a")}
                      </p>
                    </div>
                  </div>

                  {message.error_message && (
                    <div className="p-3 bg-background rounded border border-destructive/20">
                      <p className="text-xs font-semibold text-destructive mb-1">Error:</p>
                      <p className="text-sm">{message.error_message}</p>
                    </div>
                  )}

                  <div className="p-3 bg-muted/50 rounded text-sm">
                    <p className="text-xs font-semibold mb-1">Message:</p>
                    <p className="text-sm">{message.personalized_message}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
