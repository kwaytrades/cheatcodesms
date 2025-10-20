import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { Mail, Phone } from "lucide-react";

interface Contact {
  id: string;
  full_name: string;
  email: string | null;
  phone_number: string | null;
  status: string | null;
}

interface CampaignContactsDialogProps {
  campaignId: string;
  filterType: "total" | "sent" | "delivered" | "replied";
  count: number;
  children: React.ReactNode;
}

export const CampaignContactsDialog = ({
  campaignId,
  filterType,
  count,
  children,
}: CampaignContactsDialogProps) => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (open) {
      loadContacts();
    }
  }, [open, campaignId, filterType]);

  const loadContacts = async () => {
    setLoading(true);
    try {
      let contactIds: string[] = [];

      if (filterType === "total") {
        // Get all contact IDs from campaign audience_filter
        const { data: campaign } = await supabase
          .from("campaigns")
          .select("audience_filter")
          .eq("id", campaignId)
          .single();

        const audienceFilter = campaign?.audience_filter as { contact_ids?: string[] } | null;
        contactIds = audienceFilter?.contact_ids || [];
      } else if (filterType === "sent") {
        // Get contacts where messages were sent
        const { data: messages } = await supabase
          .from("campaign_messages")
          .select("phone_number")
          .eq("campaign_id", campaignId)
          .eq("status", "sent");

        const phoneNumbers = messages?.map((m) => m.phone_number) || [];
        const { data: contactsData } = await supabase
          .from("contacts")
          .select("id")
          .in("phone_number", phoneNumbers);

        contactIds = contactsData?.map((c) => c.id) || [];
      } else if (filterType === "delivered") {
        // Get contacts where messages were delivered
        const { data: messages } = await supabase
          .from("campaign_messages")
          .select("phone_number")
          .eq("campaign_id", campaignId)
          .eq("status", "delivered");

        const phoneNumbers = messages?.map((m) => m.phone_number) || [];
        const { data: contactsData } = await supabase
          .from("contacts")
          .select("id")
          .in("phone_number", phoneNumbers);

        contactIds = contactsData?.map((c) => c.id) || [];
      } else if (filterType === "replied") {
        // Get contacts who replied
        const { data: messages } = await supabase
          .from("campaign_messages")
          .select("phone_number")
          .eq("campaign_id", campaignId)
          .eq("status", "sent");

        const phoneNumbers = messages?.map((m) => m.phone_number) || [];

        // Find conversations with inbound messages from these numbers
        const { data: conversations } = await supabase
          .from("conversations")
          .select("phone_number, id")
          .in("phone_number", phoneNumbers);

        if (conversations && conversations.length > 0) {
          const convIds = conversations.map((c) => c.id);
          const { data: inboundMessages } = await supabase
            .from("messages")
            .select("conversation_id")
            .in("conversation_id", convIds)
            .eq("direction", "inbound");

          const repliedConvIds = new Set(
            inboundMessages?.map((m) => m.conversation_id) || []
          );
          const repliedPhones = conversations
            .filter((c) => repliedConvIds.has(c.id))
            .map((c) => c.phone_number);

          const { data: contactsData } = await supabase
            .from("contacts")
            .select("id")
            .in("phone_number", repliedPhones);

          contactIds = contactsData?.map((c) => c.id) || [];
        }
      }

      // Fetch contact details
      if (contactIds.length > 0) {
        const { data, error } = await supabase
          .from("contacts")
          .select("id, full_name, email, phone_number, status")
          .in("id", contactIds);

        if (error) throw error;
        setContacts(data || []);
      } else {
        setContacts([]);
      }
    } catch (error) {
      console.error("Error loading contacts:", error);
      setContacts([]);
    } finally {
      setLoading(false);
    }
  };

  const getTitle = () => {
    switch (filterType) {
      case "total":
        return "Total Contacts";
      case "sent":
        return "Sent Messages";
      case "delivered":
        return "Delivered Messages";
      case "replied":
        return "Contacts Who Replied";
      default:
        return "Contacts";
    }
  };

  const handleContactClick = (contactId: string) => {
    setOpen(false);
    navigate(`/contacts/${contactId}`);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{getTitle()}</DialogTitle>
          <DialogDescription>
            {count} contact{count !== 1 ? "s" : ""} in this category
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[400px] pr-4">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-pulse">Loading contacts...</div>
            </div>
          ) : contacts.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-muted-foreground">
              No contacts found
            </div>
          ) : (
            <div className="space-y-2">
              {contacts.map((contact) => (
                <button
                  key={contact.id}
                  onClick={() => handleContactClick(contact.id)}
                  className="w-full text-left p-3 rounded-lg border hover:bg-accent transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{contact.full_name}</p>
                        {contact.status && (
                          <Badge variant="outline" className="text-xs">
                            {contact.status}
                          </Badge>
                        )}
                      </div>
                      <div className="flex flex-col gap-1 text-sm text-muted-foreground">
                        {contact.email && (
                          <div className="flex items-center gap-2">
                            <Mail className="h-3 w-3" />
                            {contact.email}
                          </div>
                        )}
                        {contact.phone_number && (
                          <div className="flex items-center gap-2">
                            <Phone className="h-3 w-3" />
                            {contact.phone_number}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
