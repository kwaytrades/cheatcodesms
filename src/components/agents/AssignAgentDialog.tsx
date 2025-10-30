import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";

interface AssignAgentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactId?: string;
}

export function AssignAgentDialog({ open, onOpenChange, contactId }: AssignAgentDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedContact, setSelectedContact] = useState(contactId || "");
  const [productType, setProductType] = useState("");
  const [agentContext, setAgentContext] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: contacts } = useQuery({
    queryKey: ["contacts-for-assignment"],
    queryFn: async () => {
      const { data } = await supabase
        .from("contacts")
        .select("id, full_name, email")
        .order("full_name");
      return data || [];
    },
    enabled: !contactId,
  });

  const { data: activeAgent } = useQuery({
    queryKey: ["active-agent", selectedContact || contactId],
    queryFn: async () => {
      const targetContactId = selectedContact || contactId;
      if (!targetContactId) return null;

      const { data: state } = await supabase
        .from("conversation_state")
        .select("active_agent_id")
        .eq("contact_id", targetContactId)
        .single();

      if (!state?.active_agent_id) return null;

      // Check product_agents first
      const { data: productAgent } = await supabase
        .from("product_agents")
        .select("product_type")
        .eq("id", state.active_agent_id)
        .single();

      if (productAgent) {
        return { agentType: productAgent.product_type };
      }

      // If not found, check agent_conversations
      const { data: conversationAgent } = await supabase
        .from("agent_conversations")
        .select("agent_type")
        .eq("id", state.active_agent_id)
        .single();

      if (conversationAgent) {
        return { agentType: conversationAgent.agent_type };
      }

      return null;
    },
    enabled: !!(selectedContact || contactId),
  });

  const handleAssign = async () => {
    if (!selectedContact && !contactId) {
      toast({ title: "Error", description: "Please select a contact", variant: "destructive" });
      return;
    }
    
    if (!productType) {
      toast({ title: "Error", description: "Please select a product type", variant: "destructive" });
      return;
    }

    const targetContactId = selectedContact || contactId;

    setIsSubmitting(true);
    try {
      // Call the edge function to properly assign agent and trigger campaign
      const { data, error } = await supabase.functions.invoke('assign-product-agent', {
        body: {
          contact_id: targetContactId,
          product_type: productType,
          days_active: 90, // Default campaign duration
          agent_context: agentContext ? { notes: agentContext } : {}
        }
      });

      if (error) throw error;

      toast({ 
        title: "Success", 
        description: "Agent assigned and campaign started" 
      });
      onOpenChange(false);
      
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['agent-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['active-agent'] });
    } catch (error) {
      console.error('Error assigning agent:', error);
      toast({ 
        title: "Error", 
        description: error instanceof Error ? error.message : "Failed to assign agent", 
        variant: "destructive" 
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign Product Agent</DialogTitle>
          <DialogDescription>
            Assign an AI concierge agent to guide this contact through their product journey
          </DialogDescription>
          {activeAgent?.agentType && (
            <div className="mt-2 p-2 bg-muted rounded text-sm">
              <span className="text-muted-foreground">Currently active: </span>
              <span className="font-medium capitalize">{activeAgent.agentType.replace(/_/g, " ")}</span>
            </div>
          )}
        </DialogHeader>
        <div className="space-y-4">
          {!contactId && (
            <div className="space-y-2">
              <Label>Contact</Label>
              <Select value={selectedContact} onValueChange={setSelectedContact}>
                <SelectTrigger>
                  <SelectValue placeholder="Select contact" />
                </SelectTrigger>
                <SelectContent>
                  {contacts?.map((contact) => (
                    <SelectItem key={contact.id} value={contact.id}>
                      {contact.full_name} ({contact.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-2">
            <Label>Product Type</Label>
            <Select value={productType} onValueChange={setProductType}>
              <SelectTrigger>
                <SelectValue placeholder="Select product" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="webinar">Webinar</SelectItem>
                <SelectItem value="textbook">Textbook</SelectItem>
                <SelectItem value="flashcards">Flashcards</SelectItem>
                <SelectItem value="algo_monthly">Algo Monthly</SelectItem>
                <SelectItem value="ccta">CCTA</SelectItem>
                <SelectItem value="customer_service">Customer Service</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Note: Sales agents are assigned automatically via sales campaigns
            </p>
          </div>
          <div className="space-y-2">
            <Label>Agent Context (Optional)</Label>
            <Textarea
              placeholder="Add any specific goals, challenges, or preferences..."
              value={agentContext}
              onChange={(e) => setAgentContext(e.target.value)}
              rows={4}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleAssign} disabled={isSubmitting}>
            {isSubmitting ? "Assigning..." : "Assign Agent"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
