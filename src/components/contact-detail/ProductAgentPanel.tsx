import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { AgentStatusBadge } from "@/components/agents/AgentStatusBadge";
import { AgentTypeIcon } from "@/components/agents/AgentTypeIcon";
import { AssignAgentDialog } from "@/components/agents/AssignAgentDialog";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";

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

  const calculateDaysRemaining = (expirationDate: string) => {
    const days = Math.ceil((new Date(expirationDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return days > 0 ? days : 0;
  };

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
            agents?.map((agent) => (
              <div key={agent.id} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <AgentTypeIcon type={agent.product_type} className="w-8 h-8" />
                    <div>
                      <div className="font-medium capitalize">{agent.product_type.replace("_", " ")}</div>
                      <div className="text-sm text-muted-foreground">
                        {calculateDaysRemaining(agent.expiration_date)} days remaining
                      </div>
                    </div>
                  </div>
                  <AgentStatusBadge status={agent.status} />
                </div>
                <div className="flex gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Messages:</span>{" "}
                    <span className="font-medium">{agent.messages_sent}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Replies:</span>{" "}
                    <span className="font-medium">{agent.replies_received}</span>
                  </div>
                  {agent.conversion_achieved && (
                    <Badge variant="default">Converted</Badge>
                  )}
                </div>
              </div>
            ))
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
