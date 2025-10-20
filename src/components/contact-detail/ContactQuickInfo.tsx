import { Mail, Phone, MapPin, User } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ContactQuickInfoProps {
  contact: {
    full_name: string;
    email?: string;
    phone_number?: string;
    first_name?: string;
    last_name?: string;
  };
}

export const ContactQuickInfo = ({ contact }: ContactQuickInfoProps) => {
  const { id } = useParams<{ id: string }>();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [firstName, setFirstName] = useState(contact.first_name || "");
  const [lastName, setLastName] = useState(contact.last_name || "");
  const [email, setEmail] = useState(contact.email || "");
  const [phoneNumber, setPhoneNumber] = useState(contact.phone_number || "");
  const [saving, setSaving] = useState(false);
  
  const initials = contact.first_name?.[0] || contact.full_name?.[0] || "?";

  const handleSave = async () => {
    if (!id) return;
    
    setSaving(true);
    try {
      const fullName = `${firstName} ${lastName}`.trim();
      
      const { error } = await supabase
        .from("contacts")
        .update({
          first_name: firstName,
          last_name: lastName,
          full_name: fullName,
          email,
          phone_number: phoneNumber
        })
        .eq("id", id);
      
      if (error) throw error;
      toast.success("Profile updated");
      setDialogOpen(false);
      window.location.reload();
    } catch (error: any) {
      toast.error("Failed to update profile");
    } finally {
      setSaving(false);
    }
  };
  
  return (
    <>
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-col items-center text-center space-y-2">
            <Avatar className="h-16 w-16">
              <AvatarFallback className="text-lg">{initials}</AvatarFallback>
            </Avatar>
            <h3 className="font-semibold text-lg">{contact.full_name}</h3>
          </div>
          
          <div className="space-y-2 text-sm">
            {contact.email && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Mail className="h-4 w-4 shrink-0" />
                <span className="truncate">{contact.email}</span>
              </div>
            )}
            {contact.phone_number && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Phone className="h-4 w-4 shrink-0" />
                <span>{contact.phone_number}</span>
              </div>
            )}
          </div>
          
          <Button variant="outline" size="sm" className="w-full" onClick={() => setDialogOpen(true)}>
            Edit Profile
          </Button>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Profile</DialogTitle>
            <DialogDescription>Update contact information</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>First Name</Label>
                <Input
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="First name"
                />
              </div>
              <div>
                <Label>Last Name</Label>
                <Input
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Last name"
                />
              </div>
            </div>
            <div>
              <Label>Email</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@example.com"
              />
            </div>
            <div>
              <Label>Phone Number</Label>
              <Input
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="+1234567890"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
