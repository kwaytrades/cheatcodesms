import { useState } from "react";
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
  // Config state
  const [config, setConfig] = useState({
    systemPrompt: "",
    firstMessageTemplate: "",
    followUpTemplate: "",
    conversionTemplate: "",
    tone: "professional",
    maxMessagesPerWeek: 3,
    isActive: true,
  });

  const handleSaveConfig = async () => {
    // In a real implementation, save to a new agent_type_configs table
    toast({ title: "Success", description: "Agent configuration saved" });
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
              <CardTitle>System Prompt</CardTitle>
              <CardDescription>Core instructions that define this agent's personality and role</CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                rows={6}
                placeholder={`You are a friendly ${agentName} concierge. Your role is to...`}
                value={config.systemPrompt}
                onChange={(e) => setConfig({ ...config, systemPrompt: e.target.value })}
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

          <Button onClick={handleSaveConfig}>Save Templates</Button>
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
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <div className="font-medium">Product Page Visit</div>
                  <div className="text-sm text-muted-foreground">Message when they visit product page</div>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <div className="font-medium">Milestone Reached</div>
                  <div className="text-sm text-muted-foreground">Celebrate progress milestones</div>
                </div>
                <Switch />
              </div>
            </CardContent>
          </Card>

          <Button onClick={handleSaveConfig}>Save Behavior Settings</Button>
        </TabsContent>
      </Tabs>
    </div>
  );
}
