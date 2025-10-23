import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

interface AssignAgentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactId?: string;
}

export function AssignAgentDialog({ open, onOpenChange, contactId }: AssignAgentDialogProps) {
  const { toast } = useToast();
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

  const handleAssign = async () => {
    if (!selectedContact || !productType) {
      toast({ title: "Error", description: "Please select a contact and product type", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.functions.invoke("assign-product-agent", {
        body: {
          contact_id: selectedContact,
          product_type: productType,
          agent_context: { notes: agentContext },
          days_active: 30,
        },
      });

      if (error) throw error;

      toast({ title: "Success", description: "Agent assigned successfully" });
      onOpenChange(false);
    } catch (error) {
      toast({ title: "Error", description: "Failed to assign agent", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign Product Agent</DialogTitle>
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
              </SelectContent>
            </Select>
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
