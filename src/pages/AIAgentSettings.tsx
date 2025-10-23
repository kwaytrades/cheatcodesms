import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bot, BarChart3, Settings, Layers, FlaskConical } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

export default function AIAgentSettings() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [settings, setSettings] = useState({
    maxMessagesPerDay: 2,
    minHoursBetween: 12,
    maxMessagesPerWeek: 5,
    cooldownHours: 24,
    aiModel: "google/gemini-2.5-pro",
    temperature: 0.7,
    personalityDetection: true,
  });

  const handleSave = () => {
    toast({ title: "Settings saved", description: "Agent configuration updated successfully" });
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">AI Agent Settings</h1>
        <p className="text-muted-foreground">Configure agent behavior and messaging rules</p>
      </div>

      <Tabs value="settings" className="w-full">
        <TabsList>
          <TabsTrigger value="dashboard" onClick={() => navigate("/agents")}>
            <Bot className="w-4 h-4 mr-2" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="analytics" onClick={() => navigate("/agents/analytics")}>
            <BarChart3 className="w-4 h-4 mr-2" />
            Analytics
          </TabsTrigger>
          <TabsTrigger value="types" onClick={() => navigate("/agents/types")}>
            <Layers className="w-4 h-4 mr-2" />
            Agent Types
          </TabsTrigger>
          <TabsTrigger value="settings" onClick={() => navigate("/agents/settings")}>
            <Settings className="w-4 h-4 mr-2" />
            Settings
          </TabsTrigger>
          <TabsTrigger value="test" onClick={() => navigate("/agents/test")}>
            <FlaskConical className="w-4 h-4 mr-2" />
            Testing Lab
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle>Message Frequency Controls</CardTitle>
          <CardDescription>Set limits to prevent overwhelming customers</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Max Messages Per Day</Label>
              <Input
                type="number"
                value={settings.maxMessagesPerDay}
                onChange={(e) => setSettings({ ...settings, maxMessagesPerDay: parseInt(e.target.value) })}
              />
            </div>
            <div className="space-y-2">
              <Label>Min Hours Between Messages</Label>
              <Input
                type="number"
                value={settings.minHoursBetween}
                onChange={(e) => setSettings({ ...settings, minHoursBetween: parseInt(e.target.value) })}
              />
            </div>
            <div className="space-y-2">
              <Label>Max Messages Per Week</Label>
              <Input
                type="number"
                value={settings.maxMessagesPerWeek}
                onChange={(e) => setSettings({ ...settings, maxMessagesPerWeek: parseInt(e.target.value) })}
              />
            </div>
            <div className="space-y-2">
              <Label>Cooldown Period (hours)</Label>
              <Input
                type="number"
                value={settings.cooldownHours}
                onChange={(e) => setSettings({ ...settings, cooldownHours: parseInt(e.target.value) })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>AI Configuration</CardTitle>
          <CardDescription>Configure AI model and behavior</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>AI Model</Label>
            <Select value={settings.aiModel} onValueChange={(v) => setSettings({ ...settings, aiModel: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="google/gemini-2.5-pro">Gemini 2.5 Pro</SelectItem>
                <SelectItem value="google/gemini-2.5-flash">Gemini 2.5 Flash</SelectItem>
                <SelectItem value="openai/gpt-5">GPT-5</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Temperature (0.0 - 1.0)</Label>
            <Input
              type="number"
              step="0.1"
              min="0"
              max="1"
              value={settings.temperature}
              onChange={(e) => setSettings({ ...settings, temperature: parseFloat(e.target.value) })}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label>Personality Detection</Label>
              <p className="text-sm text-muted-foreground">Automatically analyze customer personality</p>
            </div>
            <Switch
              checked={settings.personalityDetection}
              onCheckedChange={(checked) => setSettings({ ...settings, personalityDetection: checked })}
            />
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSave}>Save Settings</Button>
    </div>
  );
}
