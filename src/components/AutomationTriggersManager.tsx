import { useState, useEffect } from "react";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Trash2, Zap, TrendingUp, Calendar, Activity } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export function AutomationTriggersManager() {
  const { currentWorkspace } = useWorkspace();
  const [triggers, setTriggers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  // Form state
  const [name, setName] = useState("");
  const [triggerType, setTriggerType] = useState("lead_score_increase");
  const [actionType, setActionType] = useState("send_email");
  const [threshold, setThreshold] = useState("");

  useEffect(() => {
    loadTriggers();
  }, []);

  const loadTriggers = async () => {
    if (!currentWorkspace) return;
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('automation_triggers')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTriggers(data || []);
    } catch (error) {
      console.error('Error loading triggers:', error);
      toast.error('Failed to load automation triggers');
    } finally {
      setLoading(false);
    }
  };

  const createTrigger = async () => {
    if (!name || !triggerType || !actionType) {
      toast.error("Please fill in all required fields");
      return;
    }

    try {
      const { data: user } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('automation_triggers')
        .insert([{
          name,
          trigger_type: triggerType,
          action_type: actionType,
          trigger_config: { threshold: threshold ? parseFloat(threshold) : null },
          action_config: {},
          condition_config: {},
          created_by: user?.user?.id,
          workspace_id: currentWorkspace.id,
          is_active: true
        }]);

      if (error) throw error;

      toast.success('Automation trigger created successfully');
      setIsDialogOpen(false);
      resetForm();
      loadTriggers();
    } catch (error: any) {
      console.error('Error creating trigger:', error);
      toast.error(error.message || 'Failed to create automation trigger');
    }
  };

  const toggleTrigger = async (id: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('automation_triggers')
        .update({ is_active: !isActive })
        .eq('id', id);

      if (error) throw error;
      toast.success(`Trigger ${!isActive ? 'enabled' : 'disabled'}`);
      loadTriggers();
    } catch (error) {
      console.error('Error toggling trigger:', error);
      toast.error('Failed to toggle trigger');
    }
  };

  const deleteTrigger = async (id: string) => {
    try {
      const { error } = await supabase
        .from('automation_triggers')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Trigger deleted successfully');
      loadTriggers();
    } catch (error) {
      console.error('Error deleting trigger:', error);
      toast.error('Failed to delete trigger');
    }
  };

  const resetForm = () => {
    setName("");
    setTriggerType("lead_score_increase");
    setActionType("send_email");
    setThreshold("");
  };

  const getTriggerIcon = (type: string) => {
    switch (type) {
      case 'lead_score_increase': return TrendingUp;
      case 'time_based': return Calendar;
      case 'activity_based': return Activity;
      default: return Zap;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Automation Triggers</h2>
          <p className="text-muted-foreground">Set up automated workflows based on customer actions</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Trigger
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Automation Trigger</DialogTitle>
              <DialogDescription>
                Set up a new automated workflow for your contacts
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="trigger-name">Trigger Name</Label>
                <Input
                  id="trigger-name"
                  placeholder="e.g., High Lead Score Follow-up"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="trigger-type">Trigger Type</Label>
                <Select value={triggerType} onValueChange={setTriggerType}>
                  <SelectTrigger id="trigger-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lead_score_increase">Lead Score Increase</SelectItem>
                    <SelectItem value="time_based">Time-Based</SelectItem>
                    <SelectItem value="activity_based">Activity-Based</SelectItem>
                    <SelectItem value="status_change">Status Change</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {triggerType === 'lead_score_increase' && (
                <div className="space-y-2">
                  <Label htmlFor="threshold">Score Threshold</Label>
                  <Input
                    id="threshold"
                    type="number"
                    placeholder="e.g., 80"
                    value={threshold}
                    onChange={(e) => setThreshold(e.target.value)}
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="action-type">Action</Label>
                <Select value={actionType} onValueChange={setActionType}>
                  <SelectTrigger id="action-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="send_email">Send Email</SelectItem>
                    <SelectItem value="send_sms">Send SMS</SelectItem>
                    <SelectItem value="assign_to_team">Assign to Team</SelectItem>
                    <SelectItem value="update_status">Update Status</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button onClick={createTrigger} className="w-full">
                Create Trigger
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <ScrollArea className="h-[600px]">
        <div className="space-y-3">
          {loading ? (
            <p className="text-center text-muted-foreground py-8">Loading...</p>
          ) : triggers.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center">
                <Zap className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground">No automation triggers yet</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Create your first trigger to automate your workflows
                </p>
              </CardContent>
            </Card>
          ) : (
            triggers.map((trigger) => {
              const Icon = getTriggerIcon(trigger.trigger_type);
              return (
                <Card key={trigger.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <Icon className="h-5 w-5 text-primary mt-1" />
                        <div>
                          <CardTitle className="text-base">{trigger.name}</CardTitle>
                          <CardDescription className="text-sm mt-1">
                            {trigger.trigger_type} → {trigger.action_type}
                          </CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={trigger.is_active}
                          onCheckedChange={() => toggleTrigger(trigger.id, trigger.is_active)}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteTrigger(trigger.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-4 text-sm">
                      <Badge variant={trigger.is_active ? "default" : "secondary"}>
                        {trigger.is_active ? "Active" : "Inactive"}
                      </Badge>
                      {trigger.stats && (
                        <div className="flex gap-3 text-muted-foreground">
                          <span>Sent: {trigger.stats.sent || 0}</span>
                          <span>Opened: {trigger.stats.opened || 0}</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
