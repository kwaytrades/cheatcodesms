import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, Send } from "lucide-react";
import { useState } from "react";

interface MessageComposerProps {
  onSend?: (message: string) => void;
}

export const MessageComposer = ({ onSend }: MessageComposerProps) => {
  const [message, setMessage] = useState("");

  const handleSend = () => {
    if (!message.trim()) return;
    onSend?.(message);
    setMessage("");
  };

  return (
    <div className="border-t bg-background p-4">
      <div className="space-y-2">
        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Type message..."
          className="min-h-[80px] resize-none"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
        />
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            <Button variant="outline" size="sm">
              Merge Fields ▼
            </Button>
            <Button variant="outline" size="sm">
              Templates ▼
            </Button>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm">
              <Sparkles className="h-4 w-4 mr-1" />
              AI Draft
            </Button>
            <Button size="sm" onClick={handleSend} disabled={!message.trim()}>
              <Send className="h-4 w-4 mr-1" />
              Send
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
