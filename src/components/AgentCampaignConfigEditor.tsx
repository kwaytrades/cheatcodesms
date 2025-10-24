import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Calendar, Mail, MessageSquare, Plus, Trash2, Clock, Target, Zap } from "lucide-react";

interface OutreachSchedule {
  day: number;
  type: string;
  goal: string;
  channel: string;
}

interface MilestoneTrigger {
  event: string;
  threshold?: number;
  days?: number;
  type: string;
  goal: string;
  channel: string;
}

interface CampaignConfig {
  duration_days: number;
  outreach_schedule: OutreachSchedule[];
  milestone_triggers: MilestoneTrigger[];
  frequency_limits: {
    max_per_day: number;
    max_per_week: number;
    min_hours_between: number;
  };
}

interface AgentCampaignConfigEditorProps {
  agentType: string;
}

export const AgentCampaignConfigEditor = ({ agentType }: AgentCampaignConfigEditorProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedDay, setSelectedDay] = useState(1);
  const [messageType, setMessageType] = useState("");
  const [messageGoal, setMessageGoal] = useState("engage");
  const [messageChannel, setMessageChannel] = useState("sms");

  // Fetch agent config
  const { data: agentConfig, isLoading } = useQuery({
    queryKey: ['agent-config', agentType],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('agent_type_configs')
        .select('*')
        .eq('agent_type', agentType)
        .single();
      
      if (error) throw error;
      return data;
    }
  });

  const campaignConfig = (agentConfig?.campaign_config || {
    duration_days: 90,
    outreach_schedule: [],
    milestone_triggers: [],
    frequency_limits: { max_per_day: 2, max_per_week: 5, min_hours_between: 12 }
  }) as CampaignConfig;

  // Update campaign config mutation
  const updateConfigMutation = useMutation({
    mutationFn: async (newConfig: CampaignConfig) => {
      const { error } = await supabase
        .from('agent_type_configs')
        .update({ campaign_config: newConfig as any })
        .eq('agent_type', agentType);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent-config', agentType] });
      toast({ title: "Campaign configuration updated successfully" });
    },
    onError: (error) => {
      toast({ 
        title: "Error updating configuration", 
        description: error.message, 
        variant: "destructive" 
      });
    }
  });

  const handleAddOutreach = () => {
    if (!messageType) {
      toast({ title: "Please enter a message type", variant: "destructive" });
      return;
    }

    const newSchedule = [
      ...campaignConfig.outreach_schedule,
      { day: selectedDay, type: messageType, goal: messageGoal, channel: messageChannel }
    ].sort((a, b) => a.day - b.day);

    updateConfigMutation.mutate({
      ...campaignConfig,
      outreach_schedule: newSchedule
    });

    setMessageType("");
  };

  const handleRemoveOutreach = (index: number) => {
    const newSchedule = campaignConfig.outreach_schedule.filter((_, i) => i !== index);
    updateConfigMutation.mutate({
      ...campaignConfig,
      outreach_schedule: newSchedule
    });
  };

  const handleDurationChange = (value: number[]) => {
    updateConfigMutation.mutate({
      ...campaignConfig,
      duration_days: value[0]
    });
  };

  if (isLoading) {
    return <div className="p-8 text-center">Loading campaign configuration...</div>;
  }

  const getChannelIcon = (channel: string) => {
    return channel === 'email' ? <Mail className="h-4 w-4" /> : <MessageSquare className="h-4 w-4" />;
  };

  const getGoalColor = (goal: string) => {
    const colors: Record<string, string> = {
      engage: "bg-blue-500/10 text-blue-500",
      educate: "bg-purple-500/10 text-purple-500",
      support: "bg-green-500/10 text-green-500",
      retain: "bg-yellow-500/10 text-yellow-500",
      soft_sell: "bg-orange-500/10 text-orange-500",
      upsell: "bg-red-500/10 text-red-500",
      activate: "bg-pink-500/10 text-pink-500"
    };
    return colors[goal] || "bg-muted text-muted-foreground";
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Campaign Duration
          </CardTitle>
          <CardDescription>
            How long should this agent engage with customers?
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Duration: {campaignConfig.duration_days} days</Label>
              <Badge variant="outline">{Math.floor(campaignConfig.duration_days / 30)} months</Badge>
            </div>
            <Slider
              value={[campaignConfig.duration_days]}
              onValueChange={handleDurationChange}
              min={7}
              max={180}
              step={1}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>1 week</span>
              <span>6 months</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Scheduled Outreach
          </CardTitle>
          <CardDescription>
            Add scheduled messages that fire on specific campaign days
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="space-y-2">
              <Label>Day</Label>
              <Input
                type="number"
                value={selectedDay}
                onChange={(e) => setSelectedDay(parseInt(e.target.value))}
                min={1}
                max={campaignConfig.duration_days}
              />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Input
                value={messageType}
                onChange={(e) => setMessageType(e.target.value)}
                placeholder="e.g., welcome"
              />
            </div>
            <div className="space-y-2">
              <Label>Goal</Label>
              <Select value={messageGoal} onValueChange={setMessageGoal}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="engage">Engage</SelectItem>
                  <SelectItem value="educate">Educate</SelectItem>
                  <SelectItem value="support">Support</SelectItem>
                  <SelectItem value="retain">Retain</SelectItem>
                  <SelectItem value="soft_sell">Soft Sell</SelectItem>
                  <SelectItem value="upsell">Upsell</SelectItem>
                  <SelectItem value="activate">Activate</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Channel</Label>
              <Select value={messageChannel} onValueChange={setMessageChannel}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sms">SMS</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>&nbsp;</Label>
              <Button onClick={handleAddOutreach} className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                Add
              </Button>
            </div>
          </div>

          <Separator />

          <ScrollArea className="h-[300px] pr-4">
            <div className="space-y-2">
              {campaignConfig.outreach_schedule.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No scheduled outreach configured yet
                </div>
              ) : (
                campaignConfig.outreach_schedule.map((schedule, index) => (
                  <Card key={index} className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 flex-1">
                        <div className="flex items-center gap-2 min-w-[80px]">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span className="font-semibold">Day {schedule.day}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {getChannelIcon(schedule.channel)}
                          <span className="text-sm">{schedule.type}</span>
                        </div>
                        <Badge className={getGoalColor(schedule.goal)}>
                          <Target className="h-3 w-3 mr-1" />
                          {schedule.goal}
                        </Badge>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveOutreach(index)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </Card>
                ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Frequency Limits</CardTitle>
          <CardDescription>
            Control how often this agent can reach out
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Max per Day</Label>
              <Input
                type="number"
                value={campaignConfig.frequency_limits.max_per_day}
                onChange={(e) => updateConfigMutation.mutate({
                  ...campaignConfig,
                  frequency_limits: {
                    ...campaignConfig.frequency_limits,
                    max_per_day: parseInt(e.target.value)
                  }
                })}
                min={1}
                max={10}
              />
            </div>
            <div className="space-y-2">
              <Label>Max per Week</Label>
              <Input
                type="number"
                value={campaignConfig.frequency_limits.max_per_week}
                onChange={(e) => updateConfigMutation.mutate({
                  ...campaignConfig,
                  frequency_limits: {
                    ...campaignConfig.frequency_limits,
                    max_per_week: parseInt(e.target.value)
                  }
                })}
                min={1}
                max={20}
              />
            </div>
            <div className="space-y-2">
              <Label>Min Hours Between</Label>
              <Input
                type="number"
                value={campaignConfig.frequency_limits.min_hours_between}
                onChange={(e) => updateConfigMutation.mutate({
                  ...campaignConfig,
                  frequency_limits: {
                    ...campaignConfig.frequency_limits,
                    min_hours_between: parseInt(e.target.value)
                  }
                })}
                min={1}
                max={72}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
