import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus } from "lucide-react";

export const AddContactDialog = ({ 
  open: controlledOpen,
  onOpenChange,
  onContactAdded,
  skipNavigation = false 
}: { 
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onContactAdded?: () => void;
  skipNavigation?: boolean;
}) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { currentWorkspace } = useWorkspace();
  
  // Use controlled or internal state
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = onOpenChange || setInternalOpen;

  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    phone_number: "",
    lead_status: "new",
    notes: "",
    // Influencer fields
    platform: "",
    platform_handle: "",
    follower_count: undefined as number | undefined,
    engagement_rate: undefined as number | undefined,
    influencer_tier: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.full_name) {
      toast.error("Name is required");
      return;
    }

    setLoading(true);
    try {
      // Check for duplicate email before inserting
      if (formData.email) {
        const { data: existingContact } = await supabase
          .from("contacts")
          .select("id, full_name, email")
          .eq("email", formData.email)
          .maybeSingle();

        if (existingContact) {
          toast.error(`A contact with email ${formData.email} already exists: ${existingContact.full_name}`);
          setLoading(false);
          return;
        }
      }

      // Check for duplicate phone number using database normalization
      if (formData.phone_number) {
        const { data: existingPhoneContacts } = await supabase
          .rpc('find_duplicate_phone', { input_phone: formData.phone_number });

        if (existingPhoneContacts && existingPhoneContacts.length > 0) {
          const existingContact = existingPhoneContacts[0];
          toast.error(`A contact with phone number ${formData.phone_number} already exists: ${existingContact.full_name}`);
          setLoading(false);
          return;
        }
      }

      const { data, error } = await supabase
        .from("contacts")
        .insert([{
          ...formData,
          workspace_id: currentWorkspace!.id
        }])
        .select()
        .single();

      if (error) throw error;

      toast.success("Contact created successfully");
      setOpen(false);
      setFormData({
        full_name: "",
        email: "",
        phone_number: "",
        lead_status: "new",
        notes: "",
        platform: "",
        platform_handle: "",
        follower_count: undefined,
        engagement_rate: undefined,
        influencer_tier: "",
      });
      
      if (onContactAdded) {
        onContactAdded();
      }
      
      // Only navigate if not skipping
      if (!skipNavigation) {
        navigate(`/contacts/${data.id}`);
      }
    } catch (error: any) {
      console.error("Error creating contact:", error);
      toast.error("Failed to create contact");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {/* Only show trigger if uncontrolled */}
      {controlledOpen === undefined && (
        <DialogTrigger asChild>
          <Button size="sm" className="gap-2 glow-green">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Add Contact</span>
            <span className="sm:hidden">Add</span>
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add New Contact</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="full_name">Full Name *</Label>
            <Input
              id="full_name"
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              placeholder="John Doe"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="john@example.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone_number">Phone</Label>
            <Input
              id="phone_number"
              type="tel"
              value={formData.phone_number}
              onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
              placeholder="+1234567890"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="lead_status">Lead Status</Label>
            <Select
              value={formData.lead_status}
              onValueChange={(value) => setFormData({ ...formData, lead_status: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="new">New</SelectItem>
                <SelectItem value="contacted">Contacted</SelectItem>
                <SelectItem value="qualified">Qualified</SelectItem>
                <SelectItem value="converted">Converted</SelectItem>
                <SelectItem value="lost">Lost</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Add any notes about this contact..."
              rows={3}
            />
          </div>

          {/* Influencer Fields */}
          <div className="border-t pt-4 space-y-4">
            <h4 className="text-sm font-medium">Influencer Details (Optional)</h4>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="platform">Platform</Label>
                <Select
                  value={formData.platform}
                  onValueChange={(value) => setFormData({ ...formData, platform: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select platform" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tiktok">TikTok</SelectItem>
                    <SelectItem value="youtube">YouTube</SelectItem>
                    <SelectItem value="instagram">Instagram</SelectItem>
                    <SelectItem value="blog">Blog</SelectItem>
                    <SelectItem value="twitter">Twitter</SelectItem>
                    <SelectItem value="news">News</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="platform_handle">Handle/Username</Label>
                <Input
                  id="platform_handle"
                  value={formData.platform_handle}
                  onChange={(e) => setFormData({ ...formData, platform_handle: e.target.value })}
                  placeholder="@username"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="follower_count">Followers</Label>
                <Input
                  id="follower_count"
                  type="number"
                  value={formData.follower_count || ""}
                  onChange={(e) => setFormData({ ...formData, follower_count: e.target.value ? parseInt(e.target.value) : undefined })}
                  placeholder="50000"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="engagement_rate">Engagement Rate %</Label>
                <Input
                  id="engagement_rate"
                  type="number"
                  step="0.1"
                  value={formData.engagement_rate || ""}
                  onChange={(e) => setFormData({ ...formData, engagement_rate: e.target.value ? parseFloat(e.target.value) : undefined })}
                  placeholder="5.2"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="influencer_tier">Influencer Tier</Label>
              <Select
                value={formData.influencer_tier}
                onValueChange={(value) => setFormData({ ...formData, influencer_tier: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select tier" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nano">Nano (1K-10K)</SelectItem>
                  <SelectItem value="micro">Micro (10K-100K)</SelectItem>
                  <SelectItem value="mid">Mid (100K-500K)</SelectItem>
                  <SelectItem value="macro">Macro (500K-1M)</SelectItem>
                  <SelectItem value="mega">Mega (1M+)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex gap-2 justify-end pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Creating..." : "Create Contact"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
