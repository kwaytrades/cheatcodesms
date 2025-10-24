import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";

export const TradeAnalysisStyleGuide = () => {
  const queryClient = useQueryClient();
  const [tone, setTone] = useState("professional");
  const [languageComplexity, setLanguageComplexity] = useState("intermediate");
  const [welcomeMessage, setWelcomeMessage] = useState("");
  const [offTopicRedirect, setOffTopicRedirect] = useState("");

  const { data: config, isLoading } = useQuery({
    queryKey: ["trade-analysis-style-config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agent_type_configs")
        .select("style_guide_config, system_prompts")
        .eq("agent_type", "trade_analysis")
        .single();

      if (error) throw error;

      // Initialize form values from config
      if (data?.style_guide_config) {
        const sgc = data.style_guide_config as any;
        setTone(sgc.tone || "professional");
        setLanguageComplexity(sgc.language_complexity || "intermediate");
      }

      if (data?.system_prompts) {
        const sp = data.system_prompts as any;
        setWelcomeMessage(sp.welcome_message || "");
        setOffTopicRedirect(sp.off_topic_redirect || "");
      }

      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const currentPrompts = (config?.system_prompts as any) || {};
      const { error } = await supabase
        .from("agent_type_configs")
        .update({
          style_guide_config: {
            tone,
            language_complexity: languageComplexity,
            personality: ["confident", "analytical", "supportive"],
          },
          system_prompts: {
            ...currentPrompts,
            welcome_message: welcomeMessage,
            off_topic_redirect: offTopicRedirect,
          },
        })
        .eq("agent_type", "trade_analysis");

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trade-analysis-style-config"] });
      toast.success("Style guide updated successfully");
    },
    onError: (error) => {
      toast.error(`Failed to update style guide: ${error.message}`);
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Communication Style</CardTitle>
          <CardDescription>
            Configure how the Trade Analysis Agent communicates with users
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="tone">Tone</Label>
            <Select value={tone} onValueChange={setTone}>
              <SelectTrigger id="tone">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="direct">Direct</SelectItem>
                <SelectItem value="professional">Professional</SelectItem>
                <SelectItem value="friendly">Friendly</SelectItem>
                <SelectItem value="educational">Educational</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="complexity">Language Complexity</Label>
            <Select value={languageComplexity} onValueChange={setLanguageComplexity}>
              <SelectTrigger id="complexity">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="beginner">Beginner</SelectItem>
                <SelectItem value="intermediate">Intermediate</SelectItem>
                <SelectItem value="advanced">Advanced</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Personality Traits</Label>
            <div className="flex gap-2">
              <Badge>Confident</Badge>
              <Badge>Analytical</Badge>
              <Badge>Supportive</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Message Templates</CardTitle>
          <CardDescription>
            Customize key messages sent to users
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="welcome">Welcome/Onboarding Message</Label>
            <Textarea
              id="welcome"
              placeholder="Welcome to Cheat Code AI! I'm your trading analysis assistant..."
              value={welcomeMessage}
              onChange={(e) => setWelcomeMessage(e.target.value)}
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              {welcomeMessage.length} characters (SMS limit: 160)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="offTopic">Off-Topic Redirect Message</Label>
            <Textarea
              id="offTopic"
              placeholder="I specialize in stock trading analysis. Please ask me about stocks, technical analysis, or your watchlist..."
              value={offTopicRedirect}
              onChange={(e) => setOffTopicRedirect(e.target.value)}
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              {offTopicRedirect.length} characters (SMS limit: 160)
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Save Style Guide
            </>
          )}
        </Button>
      </div>
    </div>
  );
};
