import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Pause, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { AgentStatusBadge } from "@/components/agents/AgentStatusBadge";
import { AgentTypeIcon } from "@/components/agents/AgentTypeIcon";
import { AssignAgentDialog } from "@/components/agents/AssignAgentDialog";
import { AgentNameBadge } from "@/components/agents/AgentNameBadge";
import { AgentConflictIndicator } from "@/components/agents/AgentConflictIndicator";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { formatDaysRemaining } from "@/lib/agent-utils";

interface ProductAgentPanelProps {
  contactId: string;
}

const getAgentBackgroundColor = (agentType: string, isActive: boolean) => {
  const colors: Record<string, string> = {
    sales_agent: 'bg-cyan-500/10 border-cyan-500/30',
    customer_service: 'bg-pink-500/10 border-pink-500/30',
    webinar: 'bg-blue-500/10 border-blue-500/30',
    textbook: 'bg-orange-500/10 border-orange-500/30',
    flashcards: 'bg-purple-500/10 border-purple-500/30',
    algo_monthly: 'bg-green-500/10 border-green-500/30',
    ccta: 'bg-yellow-500/10 border-yellow-500/30',
    lead_nurture: 'bg-gray-500/10 border-gray-500/30',
  };
  
  const baseColor = colors[agentType] || 'bg-muted border-border';
  return isActive ? `${baseColor} shadow-lg` : baseColor;
};

export function ProductAgentPanel({ contactId }: ProductAgentPanelProps) {
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const queryClient = useQueryClient();

  // Query both product_agents AND agent_conversations to show all agents
  const { data: productAgents } = useQuery({
    queryKey: ["product-agents", contactId],
    queryFn: async () => {
      const { data } = await supabase
        .from("product_agents")
        .select("*")
        .eq("contact_id", contactId)
        .order("assigned_date", { ascending: false });
      return data || [];
    },
  });

  const { data: conversationAgents } = useQuery({
    queryKey: ["agent-conversations", contactId],
    queryFn: async () => {
      const { data } = await supabase
        .from("agent_conversations")
        .select("*")
        .eq("contact_id", contactId)
        .eq("status", "active")
        .order("started_at", { ascending: false });
      return data || [];
    },
  });

  // Merge both types of agents into unified array, deduplicating by agent_type
  // Product agents take priority over agent_conversations for the same type
  const productAgentTypes = new Set((productAgents || []).map(pa => pa.product_type));
  
  const agents = [
    ...(productAgents || []).map(pa => ({
      id: pa.id,
      type: 'product_agent' as const,
      agent_type: pa.product_type,
      status: pa.status,
      messages_sent: pa.messages_sent,
      replies_received: pa.replies_received,
      expiration_date: pa.expiration_date,
      conversion_achieved: pa.conversion_achieved,
      created_at: pa.assigned_date
    })),
    // Only include agent_conversations that don't already exist as product_agents
    ...(conversationAgents || [])
      .filter(ca => !productAgentTypes.has(ca.agent_type))
      .map(ca => ({
        id: ca.id,
        type: 'agent_conversation' as const,
        agent_type: ca.agent_type,
        status: ca.status,
        messages_sent: ca.message_count,
        replies_received: 0,
        expiration_date: ca.expiration_date,
        conversion_achieved: false,
        created_at: ca.started_at
      }))
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const { data: conversationState } = useQuery({
    queryKey: ["conversation-state", contactId],
    queryFn: async () => {
      const { data } = await supabase
        .from("conversation_state")
        .select("active_agent_id, agent_queue")
        .eq("contact_id", contactId)
        .single();
      return data;
    },
  });

  const pauseAgentMutation = useMutation({
    mutationFn: async ({ agentId, agentType }: { agentId: string; agentType: 'product_agent' | 'agent_conversation' }) => {
      const table = agentType === 'product_agent' ? 'product_agents' : 'agent_conversations';
      const { error } = await supabase
        .from(table)
        .update({ status: 'paused', updated_at: new Date().toISOString() })
        .eq('id', agentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-agents", contactId] });
      queryClient.invalidateQueries({ queryKey: ["agent-conversations", contactId] });
      toast.success("Agent paused");
    },
    onError: () => {
      toast.error("Failed to pause agent");
    }
  });

  const deleteAgentMutation = useMutation({
    mutationFn: async ({ agentId, agentType }: { agentId: string; agentType: 'product_agent' | 'agent_conversation' }) => {
      const table = agentType === 'product_agent' ? 'product_agents' : 'agent_conversations';
      const { error } = await supabase
        .from(table)
        .delete()
        .eq('id', agentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-agents", contactId] });
      queryClient.invalidateQueries({ queryKey: ["agent-conversations", contactId] });
      toast.success("Agent removed");
    },
    onError: () => {
      toast.error("Failed to remove agent");
    }
  });


  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>AI Agents</CardTitle>
            <Button size="sm" onClick={() => setShowAssignDialog(true)}>
              <Plus className="w-4 h-4 mr-1" />
              Assign Agent
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {agents?.length === 0 ? (
            <p className="text-sm text-muted-foreground">No agents assigned yet</p>
          ) : (
            agents?.map((agent) => {
              const isActive = agent.id === conversationState?.active_agent_id;
              const queueData = conversationState?.agent_queue as Array<{ agent_id: string }> | undefined;
              const queuePosition = queueData?.findIndex((q) => q.agent_id === agent.id);
              const isQueued = queuePosition !== undefined && queuePosition >= 0;

              return (
                <div 
                  key={agent.id} 
                  className={`border rounded-lg p-4 space-y-4 transition-all ${getAgentBackgroundColor(agent.agent_type, isActive)}`}
                >
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <AgentTypeIcon type={agent.agent_type} className="w-10 h-10 flex-shrink-0" />
                      <div className="flex flex-col gap-2 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <AgentNameBadge agentType={agent.agent_type} className="text-sm font-semibold" />
                          <AgentStatusBadge status={agent.status} />
                          {agent.type === 'agent_conversation' && (
                            <Badge variant="outline" className="text-xs">Sales Campaign</Badge>
                          )}
                        </div>
                        <AgentConflictIndicator 
                          isActive={isActive}
                          queuePosition={isQueued ? queuePosition + 1 : undefined}
                        />
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex gap-4 bg-muted/30 rounded-lg p-3">
                    <div className="flex flex-col items-center flex-1">
                      <span className="text-2xl font-bold text-foreground">{agent.messages_sent}</span>
                      <span className="text-xs text-muted-foreground mt-1">Messages</span>
                    </div>
                    <div className="flex flex-col items-center flex-1">
                      <span className="text-2xl font-bold text-foreground">{agent.replies_received}</span>
                      <span className="text-xs text-muted-foreground mt-1">Replies</span>
                    </div>
                    <div className="flex flex-col items-center flex-1">
                      <span className="text-2xl font-bold text-foreground">
                        {formatDaysRemaining(agent.expiration_date, agent.agent_type)}
                      </span>
                      <span className="text-xs text-muted-foreground mt-1">
                        {agent.agent_type === 'customer_service' ? 'Indefinite' : 'Days Left'}
                      </span>
                    </div>
                  </div>
                  
                  {agent.conversion_achieved && (
                    <Badge variant="default" className="w-full justify-center py-2">
                      🎉 Converted to Customer
                    </Badge>
                  )}

                  {agent.agent_type !== 'customer_service' && (
                    <div className="flex gap-2 pt-3 border-t">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => pauseAgentMutation.mutate({ agentId: agent.id, agentType: agent.type })}
                        disabled={agent.status === 'paused' || pauseAgentMutation.isPending}
                        className="flex-1"
                      >
                        <Pause className="w-3 h-3 mr-1" />
                        {agent.status === 'paused' ? 'Paused' : 'Pause'}
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="destructive" className="flex-1">
                            <Trash2 className="w-3 h-3 mr-1" />
                            Remove
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remove Agent?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently remove this agent assignment. Message history will be preserved.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction 
                              onClick={() => deleteAgentMutation.mutate({ agentId: agent.id, agentType: agent.type })}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Remove Agent
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <AssignAgentDialog
        open={showAssignDialog}
        onOpenChange={setShowAssignDialog}
        contactId={contactId}
      />
    </>
  );
}
