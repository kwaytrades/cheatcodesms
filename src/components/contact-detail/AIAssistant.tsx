import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, X } from "lucide-react";
import { useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const AIAssistant = () => {
  const { id } = useParams<{ id: string }>();
  const [generating, setGenerating] = useState(false);
  const [suggestion, setSuggestion] = useState<string | null>("Send VIP upsell SMS. High spender, engaged, ready.");
  const [confidence, setConfidence] = useState(78);

  const handleGenerate = async () => {
    if (!id) return;
    
    setGenerating(true);
    try {
      // Get contact context
      const { data: contact } = await supabase
        .from("contacts")
        .select("*")
        .eq("id", id)
        .single();
      
      // Get recent purchases
      const { data: purchases } = await supabase
        .from("purchases")
        .select("*, products(*)")
        .eq("contact_id", id)
        .order("purchase_date", { ascending: false })
        .limit(5);
      
      // Get recent messages
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
          .limit(10);
        
        recentMessages = data || [];
      }

      // Get AI messages (emails/SMS)
      const { data: aiMessages } = await supabase
        .from("ai_messages")
        .select("*")
        .eq("contact_id", id)
        .order("sent_at", { ascending: false })
        .limit(10);
      
      // Call AI function to generate suggestion with full context
      const { data, error } = await supabase.functions.invoke("ai-agent", {
        body: {
          contactId: id,
          type: "next_best_action",
          context: {
            contact,
            purchases,
            recentMessages: [...recentMessages, ...(aiMessages || [])]
          }
        }
      });
      
      if (error) throw error;
      
      setSuggestion(data.suggestion || "No suggestion available");
      setConfidence(data.confidence || 50);
      toast.success("AI suggestion generated");
    } catch (error: any) {
      toast.error(error.message || "Failed to generate AI suggestion");
    } finally {
      setGenerating(false);
    }
  };

  const handleDismiss = () => {
    setSuggestion(null);
  };

  if (!suggestion) {
    return (
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">🤖 AI Assistant</CardTitle>
        </CardHeader>
        <CardContent>
          <Button size="sm" className="w-full" onClick={handleGenerate} disabled={generating}>
            <Sparkles className="h-3 w-3 mr-1" />
            {generating ? "Generating..." : "Generate Suggestion"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">🤖 AI Assistant</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <div className="text-xs text-muted-foreground mb-1">Next Best Action:</div>
          <p className="text-sm">
            "{suggestion}"
          </p>
        </div>
        
        <div className="text-xs text-muted-foreground">
          Confidence: <span className="font-medium text-foreground">{confidence}%</span>
        </div>
        
        <div className="flex gap-2">
          <Button size="sm" className="flex-1" onClick={handleGenerate} disabled={generating}>
            <Sparkles className="h-3 w-3 mr-1" />
            {generating ? "Generating..." : "Regenerate"}
          </Button>
          <Button size="sm" variant="ghost" onClick={handleDismiss}>
            <X className="h-3 w-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
