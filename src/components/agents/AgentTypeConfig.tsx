import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Upload, Trash2, Plus, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Link } from "react-router-dom";

interface AgentTypeConfigProps {
  agentType: string;
  agentName: string;
  agentDescription: string;
}

export function AgentTypeConfig({ agentType, agentName, agentDescription }: AgentTypeConfigProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("templates");
  const [promptTooLarge, setPromptTooLarge] = useState(false);
  const [promptSizeKB, setPromptSizeKB] = useState(0);
  
  // Config state
  const [config, setConfig] = useState({
    systemPrompt: "",
    firstMessageTemplate: "",
    followUpTemplate: "",
    conversionTemplate: "",
    tone: "professional",
    maxMessagesPerWeek: 3,
    isActive: true,
    triggerNoReply48h: true,
    triggerProductPageVisit: true,
    triggerMilestoneReached: false,
  });

  // Fetch config from database
  const { data: savedConfig, isLoading } = useQuery({
    queryKey: ['agent-config', agentType],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('agent_type_configs')
        .select('*')
        .eq('agent_type', agentType)
        .maybeSingle();
      
      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching agent config:', error);
      }
      return data;
    }
  });

  // Reset local state when agent changes or data loads
  useEffect(() => {
    if (savedConfig) {
      setConfig({
        systemPrompt: savedConfig.system_prompt || "",
        firstMessageTemplate: savedConfig.first_message_template || "",
        followUpTemplate: savedConfig.follow_up_template || "",
        conversionTemplate: savedConfig.conversion_template || "",
        tone: savedConfig.tone || "professional",
        maxMessagesPerWeek: savedConfig.max_messages_per_week || 3,
        isActive: savedConfig.is_active ?? true,
        triggerNoReply48h: savedConfig.trigger_no_reply_48h ?? true,
        triggerProductPageVisit: savedConfig.trigger_product_page_visit ?? true,
        triggerMilestoneReached: savedConfig.trigger_milestone_reached ?? false,
      });
    } else {
      // Reset to defaults when switching agents with no saved config
      setConfig({
        systemPrompt: "",
        firstMessageTemplate: "",
        followUpTemplate: "",
        conversionTemplate: "",
        tone: "professional",
        maxMessagesPerWeek: 3,
        isActive: true,
        triggerNoReply48h: true,
        triggerProductPageVisit: true,
        triggerMilestoneReached: false,
      });
    }
  }, [agentType, savedConfig]);

  // Monitor prompt size
  useEffect(() => {
    const sizeKB = new Blob([config.systemPrompt]).size / 1024;
    setPromptSizeKB(Math.round(sizeKB * 10) / 10);
    setPromptTooLarge(sizeKB > 10);
  }, [config.systemPrompt]);

  // Save to database
  const saveMutation = useMutation({
    mutationFn: async () => {
      // Validate prompt size
      const promptSize = new Blob([config.systemPrompt]).size;
      
      if (promptSize > 50000) { // > 50KB
        throw new Error(
          `System prompt is too large (${Math.round(promptSize / 1024)}KB). ` +
          'Please reduce to under 50KB or move detailed content to Knowledge Base. ' +
          'Tip: Keep prompts focused on personality and guidelines, not detailed product information.'
        );
      }
      
      const { data, error } = await supabase
        .from('agent_type_configs')
        .upsert({
          agent_type: agentType,
          system_prompt: config.systemPrompt,
          first_message_template: config.firstMessageTemplate,
          follow_up_template: config.followUpTemplate,
          conversion_template: config.conversionTemplate,
          tone: config.tone,
          max_messages_per_week: config.maxMessagesPerWeek,
          is_active: config.isActive,
          trigger_no_reply_48h: config.triggerNoReply48h,
          trigger_product_page_visit: config.triggerProductPageVisit,
          trigger_milestone_reached: config.triggerMilestoneReached,
        }, {
          onConflict: 'agent_type'
        })
        .select()
        .single();
      
      if (error) {
        console.error('Save error details:', error);
        throw error;
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent-config', agentType] });
      toast({ title: "Saved", description: "Agent configuration updated successfully" });
    },
    onError: (error) => {
      console.error('Error saving config:', error);
      toast({ 
        title: "Error", 
        description: "Failed to save agent configuration",
        variant: "destructive"
      });
    }
  });

  const handleSaveConfig = () => {
    saveMutation.mutate();
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{agentName}</CardTitle>
          <CardDescription>{agentDescription}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <Label>Agent Active</Label>
              <p className="text-sm text-muted-foreground">Enable or disable this agent type</p>
            </div>
            <Switch
              checked={config.isActive}
              onCheckedChange={(checked) => setConfig({ ...config, isActive: checked })}
            />
          </div>
          <div className="mt-4 p-3 bg-muted/50 rounded-lg border">
            <p className="text-sm text-muted-foreground">
              💡 <strong>Knowledge Base:</strong> Upload agent-specific documents in{" "}
              <Link to="/settings" className="text-primary hover:underline">
                Settings → Knowledge Base
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full">
          <TabsTrigger value="templates" className="flex-1">Message Templates</TabsTrigger>
          <TabsTrigger value="behavior" className="flex-1">Behavior</TabsTrigger>
        </TabsList>

        <TabsContent value="templates" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>System Prompt</span>
                <span className="text-sm font-normal text-muted-foreground">{promptSizeKB}KB</span>
              </CardTitle>
              <CardDescription>
                Core instructions that define this agent's personality and role
                {promptTooLarge && (
                  <div className="mt-3 p-3 bg-destructive/10 border border-destructive/30 rounded-md flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-destructive space-y-1">
                      <div className="font-semibold">⚠️ Prompt Too Large ({promptSizeKB}KB)</div>
                      <div>Large prompts cause verbose, repetitive responses. Keep under 10KB for best results.</div>
                      <div className="mt-2 text-xs">
                        <strong>Best practice:</strong> Keep prompts focused on personality & guidelines (~2-3KB). 
                        Move detailed product info to Knowledge Base.
                      </div>
                    </div>
                  </div>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                rows={6}
                placeholder={`You are a friendly ${agentName} concierge. Your role is to...`}
                value={config.systemPrompt}
                onChange={(e) => setConfig({ ...config, systemPrompt: e.target.value })}
                className={promptTooLarge ? "border-destructive" : ""}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>First Message Template</CardTitle>
              <CardDescription>Initial message sent when agent is assigned</CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                rows={4}
                placeholder="Hi {{first_name}}! I'm excited to help you with..."
                value={config.firstMessageTemplate}
                onChange={(e) => setConfig({ ...config, firstMessageTemplate: e.target.value })}
              />
              <p className="text-xs text-muted-foreground mt-2">
                Available variables: {`{{first_name}}, {{last_name}}, {{product_name}}, {{context}}`}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Follow-up Template</CardTitle>
              <CardDescription>Template for subsequent check-in messages</CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                rows={4}
                placeholder="Hey {{first_name}}, just checking in..."
                value={config.followUpTemplate}
                onChange={(e) => setConfig({ ...config, followUpTemplate: e.target.value })}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Conversion Template</CardTitle>
              <CardDescription>Message sent when trying to convert the lead</CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                rows={4}
                placeholder="{{first_name}}, based on your interests..."
                value={config.conversionTemplate}
                onChange={(e) => setConfig({ ...config, conversionTemplate: e.target.value })}
              />
            </CardContent>
          </Card>

          <Button onClick={handleSaveConfig} disabled={saveMutation.isPending || isLoading}>
            {saveMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Templates'
            )}
          </Button>
        </TabsContent>

        <TabsContent value="behavior" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Communication Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Message Tone</Label>
                <select
                  className="w-full border rounded-md p-2"
                  value={config.tone}
                  onChange={(e) => setConfig({ ...config, tone: e.target.value })}
                >
                  <option value="professional">Professional</option>
                  <option value="friendly">Friendly</option>
                  <option value="casual">Casual</option>
                  <option value="formal">Formal</option>
                  <option value="enthusiastic">Enthusiastic</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label>Max Messages Per Week</Label>
                <Input
                  type="number"
                  value={config.maxMessagesPerWeek}
                  onChange={(e) => setConfig({ ...config, maxMessagesPerWeek: parseInt(e.target.value) })}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Trigger Rules</CardTitle>
              <CardDescription>Define when this agent should send messages</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <div className="font-medium">No Reply After 48 Hours</div>
                  <div className="text-sm text-muted-foreground">Send follow-up if no response</div>
                </div>
                <Switch 
                  checked={config.triggerNoReply48h}
                  onCheckedChange={(checked) => setConfig({ ...config, triggerNoReply48h: checked })}
                />
              </div>
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <div className="font-medium">Product Page Visit</div>
                  <div className="text-sm text-muted-foreground">Message when they visit product page</div>
                </div>
                <Switch 
                  checked={config.triggerProductPageVisit}
                  onCheckedChange={(checked) => setConfig({ ...config, triggerProductPageVisit: checked })}
                />
              </div>
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <div className="font-medium">Milestone Reached</div>
                  <div className="text-sm text-muted-foreground">Celebrate progress milestones</div>
                </div>
                <Switch 
                  checked={config.triggerMilestoneReached}
                  onCheckedChange={(checked) => setConfig({ ...config, triggerMilestoneReached: checked })}
                />
              </div>
            </CardContent>
          </Card>

          <Button onClick={handleSaveConfig} disabled={saveMutation.isPending || isLoading}>
            {saveMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Behavior Settings'
            )}
          </Button>
        </TabsContent>
      </Tabs>
    </div>
  );
}
