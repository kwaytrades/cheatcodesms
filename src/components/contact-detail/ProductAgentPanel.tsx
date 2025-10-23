import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
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

export function ProductAgentPanel({ contactId }: ProductAgentPanelProps) {
  const [showAssignDialog, setShowAssignDialog] = useState(false);

  const { data: agents } = useQuery({
    queryKey: ["contact-agents", contactId],
    queryFn: async () => {
      const { data } = await supabase
        .from("product_agents")
        .select("*")
        .eq("contact_id", contactId)
        .order("assigned_date", { ascending: false });
      return data || [];
    },
  });

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
                  className={`border rounded-lg p-4 space-y-4 transition-all ${
                    isActive ? 'bg-primary/5 border-primary/30 shadow-lg' : 'hover:border-border/60'
                  }`}
                >
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <AgentTypeIcon type={agent.product_type} className="w-10 h-10 flex-shrink-0" />
                      <div className="flex flex-col gap-2 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <AgentNameBadge agentType={agent.product_type} className="text-sm font-semibold" />
                          <AgentStatusBadge status={agent.status} />
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
                        {formatDaysRemaining(agent.expiration_date, agent.product_type)}
                      </span>
                      <span className="text-xs text-muted-foreground mt-1">
                        {agent.product_type === 'customer_service' ? 'Indefinite' : 'Days Left'}
                      </span>
                    </div>
                  </div>
                  
                  {agent.conversion_achieved && (
                    <Badge variant="default" className="w-full justify-center py-2">
                      🎉 Converted to Customer
                    </Badge>
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
