import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Loader2, Save, Shield } from "lucide-react";
import { toast } from "sonner";

export const GuardrailsSettings = () => {
  const queryClient = useQueryClient();
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.7);
  const [maxAnalysesPerHour, setMaxAnalysesPerHour] = useState(10);
  const [maxMessagesPerDay, setMaxMessagesPerDay] = useState(50);
  const [multiTickerBehavior, setMultiTickerBehavior] = useState("clarification_required");
  const [allowedTopics, setAllowedTopics] = useState("");
  const [restrictedTopics, setRestrictedTopics] = useState("");
  const [educationalMaxLength, setEducationalMaxLength] = useState(160);

  const { data: config, isLoading } = useQuery({
    queryKey: ["trade-analysis-guardrails"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agent_type_configs")
        .select("guardrails_config")
        .eq("agent_type", "trade_analysis")
        .single();

      if (error) throw error;

      if (data?.guardrails_config) {
        const gc = data.guardrails_config as any;
        setConfidenceThreshold(gc.confidence_threshold || 0.7);
        setMaxAnalysesPerHour(gc.max_analyses_per_hour || 10);
        setMaxMessagesPerDay(gc.max_messages_per_day || 50);
        setMultiTickerBehavior(gc.multi_ticker_behavior || "clarification_required");
        setAllowedTopics(gc.allowed_educational_topics?.join(", ") || "");
        setRestrictedTopics(gc.restricted_topics?.join(", ") || "");
        setEducationalMaxLength(gc.educational_response_max_length || 160);
      }

      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("agent_type_configs")
        .update({
          guardrails_config: {
            confidence_threshold: confidenceThreshold,
            max_analyses_per_hour: maxAnalysesPerHour,
            max_messages_per_day: maxMessagesPerDay,
            multi_ticker_behavior: multiTickerBehavior,
            allowed_educational_topics: allowedTopics.split(",").map(t => t.trim()).filter(Boolean),
            restricted_topics: restrictedTopics.split(",").map(t => t.trim()).filter(Boolean),
            educational_response_max_length: educationalMaxLength,
            credit_warning_thresholds: [3, 1, 0],
          },
        })
        .eq("agent_type", "trade_analysis");

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trade-analysis-guardrails"] });
      toast.success("Guardrails updated successfully");
    },
    onError: (error) => {
      toast.error(`Failed to update guardrails: ${error.message}`);
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
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            <CardTitle>Intent Classification Settings</CardTitle>
          </div>
          <CardDescription>
            Configure how the agent classifies and handles user messages
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Confidence Threshold</Label>
              <span className="text-sm text-muted-foreground">{confidenceThreshold.toFixed(2)}</span>
            </div>
            <Slider
              value={[confidenceThreshold]}
              onValueChange={([value]) => setConfidenceThreshold(value)}
              min={0.5}
              max={0.95}
              step={0.05}
            />
            <p className="text-xs text-muted-foreground">
              Minimum confidence to auto-route messages. Lower = more aggressive, Higher = more cautious
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="multiTicker">Multi-Ticker Handling</Label>
            <Select value={multiTickerBehavior} onValueChange={setMultiTickerBehavior}>
              <SelectTrigger id="multiTicker">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="clarification_required">Ask for Clarification</SelectItem>
                <SelectItem value="analyze_first">Analyze First Mentioned</SelectItem>
                <SelectItem value="reject">Reject with Error</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Rate Limiting</CardTitle>
          <CardDescription>
            Prevent spam and abuse with rate limits
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="maxAnalyses">Max Analyses per Hour (per user)</Label>
            <Input
              id="maxAnalyses"
              type="number"
              min={1}
              max={100}
              value={maxAnalysesPerHour}
              onChange={(e) => setMaxAnalysesPerHour(parseInt(e.target.value))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="maxMessages">Max Messages per Day (per user)</Label>
            <Input
              id="maxMessages"
              type="number"
              min={10}
              max={500}
              value={maxMessagesPerDay}
              onChange={(e) => setMaxMessagesPerDay(parseInt(e.target.value))}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Topic Boundaries</CardTitle>
          <CardDescription>
            Define what the agent can and cannot discuss
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="allowed">Allowed Educational Topics (comma-separated)</Label>
            <Textarea
              id="allowed"
              placeholder="RSI, MACD, Support, Resistance, Chart Patterns..."
              value={allowedTopics}
              onChange={(e) => setAllowedTopics(e.target.value)}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="restricted">Restricted Topics (comma-separated)</Label>
            <Textarea
              id="restricted"
              placeholder="politics, personal advice, financial advice..."
              value={restrictedTopics}
              onChange={(e) => setRestrictedTopics(e.target.value)}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="eduLength">Educational Response Max Length</Label>
            <Input
              id="eduLength"
              type="number"
              min={50}
              max={500}
              value={educationalMaxLength}
              onChange={(e) => setEducationalMaxLength(parseInt(e.target.value))}
            />
            <p className="text-xs text-muted-foreground">
              SMS-friendly: 160 characters. Longer responses may be split into multiple messages.
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
              Save Guardrails
            </>
          )}
        </Button>
      </div>
    </div>
  );
};
