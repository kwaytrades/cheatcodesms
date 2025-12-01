import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MessageSquare, Mail, Phone, UserPlus, Tag } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const QuickActions = () => {
  const { id } = useParams<{ id: string }>();
  const { currentWorkspace } = useWorkspace();
  const [smsOpen, setSmsOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [callOpen, setCallOpen] = useState(false);
  const [handoffOpen, setHandoffOpen] = useState(false);
  const [tagsOpen, setTagsOpen] = useState(false);
  
  const [smsMessage, setSmsMessage] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [callNotes, setCallNotes] = useState("");
  const [callDate, setCallDate] = useState("");
  const [handoffNotes, setHandoffNotes] = useState("");
  const [newTag, setNewTag] = useState("");
  const [sending, setSending] = useState(false);

  const handleSendSMS = async () => {
    if (!smsMessage.trim() || !id) return;
    
    setSending(true);
    try {
      const { error } = await supabase.functions.invoke("send-sms", {
        body: { contactId: id, message: smsMessage }
      });
      
      if (error) throw error;
      toast.success("SMS sent successfully");
      setSmsMessage("");
      setSmsOpen(false);
    } catch (error: any) {
      toast.error(error.message || "Failed to send SMS");
    } finally {
      setSending(false);
    }
  };

  const handleSendEmail = async () => {
    if (!emailSubject.trim() || !emailBody.trim() || !id) return;
    
    setSending(true);
    try {
      // First, fetch the contact's email address
      const { data: contact, error: fetchError } = await supabase
        .from("contacts")
        .select("email")
        .eq("id", id)
        .single();
      
      if (fetchError) throw fetchError;
      if (!contact?.email) {
        toast.error("Contact does not have an email address");
        return;
      }
      
      const { error } = await supabase.functions.invoke("send-email", {
        body: { 
          to: contact.email, 
          subject: emailSubject, 
          htmlBody: emailBody 
        }
      });
      
      if (error) throw error;
      toast.success("Email sent successfully");
      setEmailSubject("");
      setEmailBody("");
      setEmailOpen(false);
    } catch (error: any) {
      toast.error(error.message || "Failed to send email");
    } finally {
      setSending(false);
    }
  };

  const handleScheduleCall = async () => {
    if (!callDate || !id) return;
    
    setSending(true);
    try {
      const { error } = await supabase
        .from("contact_activities")
        .insert([{
          contact_id: id,
          activity_type: "call_scheduled",
          description: `Call scheduled for ${new Date(callDate).toLocaleString()}`,
          metadata: { scheduled_date: callDate, notes: callNotes },
          workspace_id: currentWorkspace!.id
        }]);
      
      if (error) throw error;
      toast.success("Call scheduled");
      setCallDate("");
      setCallNotes("");
      setCallOpen(false);
    } catch (error: any) {
      toast.error("Failed to schedule call");
    } finally {
      setSending(false);
    }
  };

  const handleHandoff = async () => {
    if (!handoffNotes.trim() || !id) return;
    
    setSending(true);
    try {
      const { error } = await supabase
        .from("contact_activities")
        .insert([{
          contact_id: id,
          activity_type: "handoff_to_human",
          description: "Contact handed off to human agent",
          metadata: { notes: handoffNotes },
          workspace_id: currentWorkspace!.id
        }]);
      
      if (error) throw error;
      toast.success("Contact handed off to human agent");
      setHandoffNotes("");
      setHandoffOpen(false);
    } catch (error: any) {
      toast.error("Failed to hand off contact");
    } finally {
      setSending(false);
    }
  };

  const handleAddTag = async () => {
    if (!newTag.trim() || !id) return;
    
    setSending(true);
    try {
      const { data: contact } = await supabase
        .from("contacts")
        .select("tags")
        .eq("id", id)
        .single();
      
      const currentTags = contact?.tags || [];
      const updatedTags = [...currentTags, newTag.trim()];
      
      const { error } = await supabase
        .from("contacts")
        .update({ tags: updatedTags })
        .eq("id", id);
      
      if (error) throw error;
      toast.success("Tag added");
      setNewTag("");
      setTagsOpen(false);
      window.location.reload();
    } catch (error: any) {
      toast.error("Failed to add tag");
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">🎯 Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button variant="outline" size="sm" className="w-full justify-start" onClick={() => setSmsOpen(true)}>
            <MessageSquare className="h-4 w-4 mr-2" />
            Send SMS
          </Button>
          <Button variant="outline" size="sm" className="w-full justify-start" onClick={() => setEmailOpen(true)}>
            <Mail className="h-4 w-4 mr-2" />
            Send Email
          </Button>
          <Button variant="outline" size="sm" className="w-full justify-start" onClick={() => setCallOpen(true)}>
            <Phone className="h-4 w-4 mr-2" />
            Schedule Call
          </Button>
          <Button variant="outline" size="sm" className="w-full justify-start" onClick={() => setHandoffOpen(true)}>
            <UserPlus className="h-4 w-4 mr-2" />
            Hand to Human
          </Button>
          <Button variant="outline" size="sm" className="w-full justify-start" onClick={() => setTagsOpen(true)}>
            <Tag className="h-4 w-4 mr-2" />
            Add Tags
          </Button>
        </CardContent>
      </Card>

      {/* Send SMS Dialog */}
      <Dialog open={smsOpen} onOpenChange={setSmsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send SMS</DialogTitle>
            <DialogDescription>Send an SMS message to this contact</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Message</Label>
              <Textarea
                value={smsMessage}
                onChange={(e) => setSmsMessage(e.target.value)}
                placeholder="Type your message..."
                rows={4}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setSmsOpen(false)}>Cancel</Button>
              <Button onClick={handleSendSMS} disabled={sending || !smsMessage.trim()}>
                {sending ? "Sending..." : "Send SMS"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Send Email Dialog */}
      <Dialog open={emailOpen} onOpenChange={setEmailOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Email</DialogTitle>
            <DialogDescription>Send an email to this contact</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Subject</Label>
              <Input
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                placeholder="Email subject..."
              />
            </div>
            <div>
              <Label>Message</Label>
              <Textarea
                value={emailBody}
                onChange={(e) => setEmailBody(e.target.value)}
                placeholder="Type your message..."
                rows={6}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setEmailOpen(false)}>Cancel</Button>
              <Button onClick={handleSendEmail} disabled={sending || !emailSubject.trim() || !emailBody.trim()}>
                {sending ? "Sending..." : "Send Email"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Schedule Call Dialog */}
      <Dialog open={callOpen} onOpenChange={setCallOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schedule Call</DialogTitle>
            <DialogDescription>Schedule a call with this contact</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Date & Time</Label>
              <Input
                type="datetime-local"
                value={callDate}
                onChange={(e) => setCallDate(e.target.value)}
              />
            </div>
            <div>
              <Label>Notes (optional)</Label>
              <Textarea
                value={callNotes}
                onChange={(e) => setCallNotes(e.target.value)}
                placeholder="Add notes about the call..."
                rows={3}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setCallOpen(false)}>Cancel</Button>
              <Button onClick={handleScheduleCall} disabled={sending || !callDate}>
                {sending ? "Scheduling..." : "Schedule Call"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Hand to Human Dialog */}
      <Dialog open={handoffOpen} onOpenChange={setHandoffOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hand to Human</DialogTitle>
            <DialogDescription>Transfer this contact to a human agent</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Handoff Notes</Label>
              <Textarea
                value={handoffNotes}
                onChange={(e) => setHandoffNotes(e.target.value)}
                placeholder="Provide context for the human agent..."
                rows={4}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setHandoffOpen(false)}>Cancel</Button>
              <Button onClick={handleHandoff} disabled={sending || !handoffNotes.trim()}>
                {sending ? "Processing..." : "Hand Off"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Tags Dialog */}
      <Dialog open={tagsOpen} onOpenChange={setTagsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Tag</DialogTitle>
            <DialogDescription>Add a new tag to this contact</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Tag Name</Label>
              <Input
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                placeholder="e.g., VIP, High Priority..."
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setTagsOpen(false)}>Cancel</Button>
              <Button onClick={handleAddTag} disabled={sending || !newTag.trim()}>
                {sending ? "Adding..." : "Add Tag"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
