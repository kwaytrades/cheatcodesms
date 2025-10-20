import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AIPersonalizationEngineProps {
  contacts: any[];
  onPersonalizedMessage: (message: string) => void;
}

export function AIPersonalizationEngine({ contacts, onPersonalizedMessage }: AIPersonalizationEngineProps) {
  const [baseMessage, setBaseMessage] = useState("");
  const [generating, setGenerating] = useState(false);
  const [personalizedMessages, setPersonalizedMessages] = useState<Record<string, string>>({});

  const generatePersonalizedMessages = async () => {
    if (!baseMessage.trim()) {
      toast.error("Please enter a base message");
      return;
    }

    if (contacts.length === 0) {
      toast.error("No contacts selected");
      return;
    }

    setGenerating(true);
    try {
      const messages: Record<string, string> = {};

      for (const contact of contacts.slice(0, 5)) { // Limit to 5 for demo
        const context = {
          name: contact.full_name,
          trading_experience: contact.trading_experience,
          trading_style: contact.trading_style,
          assets_traded: contact.assets_traded,
          lead_score: contact.lead_score,
          total_spent: contact.total_spent,
        };

        const { data, error } = await supabase.functions.invoke('ai-agent', {
          body: {
            type: 'personalize',
            base_message: baseMessage,
            contact_context: context
          }
        });

        if (error) throw error;
        messages[contact.id] = data.personalized_message || baseMessage;
      }

      setPersonalizedMessages(messages);
      toast.success(`Generated ${Object.keys(messages).length} personalized messages`);
    } catch (error: any) {
      console.error('Error generating personalized messages:', error);
      toast.error(error.message || 'Failed to generate personalized messages');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <CardTitle>AI Personalization Engine</CardTitle>
        </div>
        <CardDescription>
          Generate personalized messages using AI based on customer context
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="base-message">Base Message Template</Label>
          <Textarea
            id="base-message"
            placeholder="Write your base message here. AI will personalize it for each contact based on their trading profile, interests, and behavior..."
            value={baseMessage}
            onChange={(e) => setBaseMessage(e.target.value)}
            rows={6}
          />
          <p className="text-xs text-muted-foreground">
            The AI will adapt this message for each contact using their trading experience, style, interests, and engagement history.
          </p>
        </div>

        <Button 
          onClick={generatePersonalizedMessages}
          disabled={generating || !baseMessage.trim() || contacts.length === 0}
          className="w-full"
        >
          {generating ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4 mr-2" />
              Generate Personalized Messages
            </>
          )}
        </Button>

        {Object.keys(personalizedMessages).length > 0 && (
          <div className="space-y-3 pt-4 border-t">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold">Generated Messages</h4>
              <Badge variant="secondary">
                {Object.keys(personalizedMessages).length} messages
              </Badge>
            </div>
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {Object.entries(personalizedMessages).map(([contactId, message]) => {
                const contact = contacts.find(c => c.id === contactId);
                return (
                  <Card key={contactId} className="bg-muted/50">
                    <CardContent className="pt-4">
                      <p className="text-xs font-medium text-muted-foreground mb-2">
                        {contact?.full_name}
                      </p>
                      <p className="text-sm">{message}</p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
