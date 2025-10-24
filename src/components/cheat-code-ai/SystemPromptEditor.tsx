import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save, RotateCcw } from "lucide-react";
import { toast } from "sonner";

const DEFAULT_PROMPTS = {
  analysis_prompt: "You are a professional stock trading analyst. Provide technical analysis for {symbol} with current price {price}. Include support/resistance levels, momentum indicators, and setup type.",
  intent_classification_prompt: "Classify the user message intent: analyze_stock, watchlist_add, watchlist_remove, check_credits, educational_question, off_topic.",
  educational_prompt: "Answer trading questions clearly in under 160 characters. Focus on actionable insights.",
  guardrails_prompt: "Only discuss stock trading topics. Redirect off-topic questions politely.",
};

export const SystemPromptEditor = () => {
  const queryClient = useQueryClient();
  const [prompts, setPrompts] = useState(DEFAULT_PROMPTS);

  const { data: config, isLoading } = useQuery({
    queryKey: ["trade-analysis-prompts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agent_type_configs")
        .select("system_prompts")
        .eq("agent_type", "trade_analysis")
        .single();

      if (error) throw error;

      if (data?.system_prompts) {
        const sp = data.system_prompts as any;
        setPrompts({
          analysis_prompt: sp.analysis_prompt || DEFAULT_PROMPTS.analysis_prompt,
          intent_classification_prompt: sp.intent_classification_prompt || DEFAULT_PROMPTS.intent_classification_prompt,
          educational_prompt: sp.educational_prompt || DEFAULT_PROMPTS.educational_prompt,
          guardrails_prompt: sp.guardrails_prompt || DEFAULT_PROMPTS.guardrails_prompt,
        });
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
          system_prompts: {
            ...currentPrompts,
            ...prompts,
          },
        })
        .eq("agent_type", "trade_analysis");

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trade-analysis-prompts"] });
      toast.success("System prompts updated successfully");
    },
    onError: (error) => {
      toast.error(`Failed to update prompts: ${error.message}`);
    },
  });

  const resetToDefaults = () => {
    setPrompts(DEFAULT_PROMPTS);
    toast.info("Reset to default prompts");
  };

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
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>System Prompts</CardTitle>
              <CardDescription>
                Customize the core prompts that drive the Trade Analysis Agent's behavior
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={resetToDefaults}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Reset to Defaults
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="analysis">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="analysis">Analysis</TabsTrigger>
              <TabsTrigger value="intent">Intent</TabsTrigger>
              <TabsTrigger value="education">Education</TabsTrigger>
              <TabsTrigger value="guardrails">Guardrails</TabsTrigger>
            </TabsList>

            <TabsContent value="analysis" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="analysis">Stock Analysis Prompt</Label>
                <p className="text-sm text-muted-foreground">
                  Used when analyzing stock tickers. Variables: {"{symbol}"}, {"{price}"}, {"{indicators}"}
                </p>
                <Textarea
                  id="analysis"
                  value={prompts.analysis_prompt}
                  onChange={(e) => setPrompts({ ...prompts, analysis_prompt: e.target.value })}
                  rows={6}
                  className="font-mono text-sm"
                />
                <div className="flex gap-2">
                  <Badge variant="outline">Professional</Badge>
                  <Badge variant="outline">Technical</Badge>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="intent" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="intent">Intent Classification Prompt</Label>
                <p className="text-sm text-muted-foreground">
                  Used to classify user message intent and extract entities
                </p>
                <Textarea
                  id="intent"
                  value={prompts.intent_classification_prompt}
                  onChange={(e) => setPrompts({ ...prompts, intent_classification_prompt: e.target.value })}
                  rows={6}
                  className="font-mono text-sm"
                />
                <div className="flex gap-2">
                  <Badge variant="outline">Classification</Badge>
                  <Badge variant="outline">Entity Extraction</Badge>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="education" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="education">Educational Response Prompt</Label>
                <p className="text-sm text-muted-foreground">
                  Used when answering "What is..." or "How to..." questions
                </p>
                <Textarea
                  id="education"
                  value={prompts.educational_prompt}
                  onChange={(e) => setPrompts({ ...prompts, educational_prompt: e.target.value })}
                  rows={6}
                  className="font-mono text-sm"
                />
                <div className="flex gap-2">
                  <Badge variant="outline">Concise</Badge>
                  <Badge variant="outline">SMS-friendly</Badge>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="guardrails" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="guardrails">Guardrails Prompt</Label>
                <p className="text-sm text-muted-foreground">
                  Defines conversation boundaries and off-topic handling
                </p>
                <Textarea
                  id="guardrails"
                  value={prompts.guardrails_prompt}
                  onChange={(e) => setPrompts({ ...prompts, guardrails_prompt: e.target.value })}
                  rows={6}
                  className="font-mono text-sm"
                />
                <div className="flex gap-2">
                  <Badge variant="outline">Boundaries</Badge>
                  <Badge variant="outline">Safety</Badge>
                </div>
              </div>
            </TabsContent>
          </Tabs>
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
              Save Prompts
            </>
          )}
        </Button>
      </div>
    </div>
  );
};
