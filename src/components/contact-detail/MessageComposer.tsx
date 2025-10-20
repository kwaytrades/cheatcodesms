import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, Send } from "lucide-react";
import { useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface MessageComposerProps {
  onSend?: (message: string) => void;
}

export const MessageComposer = ({ onSend }: MessageComposerProps) => {
  const { id } = useParams<{ id: string }>();
  const [message, setMessage] = useState("");
  const [generating, setGenerating] = useState(false);

  const handleSend = () => {
    if (!message.trim()) return;
    onSend?.(message);
    setMessage("");
  };

  const handleAIDraft = async () => {
    if (!id) return;
    
    setGenerating(true);
    try {
      // Get contact context
      const { data: contact } = await supabase
        .from("contacts")
        .select("*")
        .eq("id", id)
        .single();
      
      const { data: conversationData } = await supabase
        .from("conversations")
        .select("id")
        .eq("contact_id", id)
        .maybeSingle();
      
      let recentMessages = [];
      if (conversationData) {
        const { data } = await supabase
          .from("messages")
          .select("*")
          .eq("conversation_id", conversationData.id)
          .order("created_at", { ascending: false })
          .limit(5);
        
        recentMessages = data || [];
      }
      
      // Call AI function to generate draft
      const { data, error } = await supabase.functions.invoke("ai-agent", {
        body: {
          contactId: id,
          type: "generate_message",
          context: {
            contact,
            recentMessages
          }
        }
      });
      
      if (error) throw error;
      
      setMessage(data.message || "");
      toast.success("AI draft generated");
    } catch (error: any) {
      toast.error(error.message || "Failed to generate AI draft");
    } finally {
      setGenerating(false);
    }
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
            <Button variant="outline" size="sm" onClick={handleAIDraft} disabled={generating}>
              <Sparkles className="h-4 w-4 mr-1" />
              {generating ? "Generating..." : "AI Draft"}
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
