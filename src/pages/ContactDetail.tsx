import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, X } from "lucide-react";
import { ContactQuickInfo } from "@/components/contact-detail/ContactQuickInfo";
import { KeyMetrics } from "@/components/contact-detail/KeyMetrics";
import { ProductsList } from "@/components/contact-detail/ProductsList";
import { TradingProfile } from "@/components/contact-detail/TradingProfile";
import { SourceAttribution } from "@/components/contact-detail/SourceAttribution";
import { QuickActions } from "@/components/contact-detail/QuickActions";
import { AIAssistant } from "@/components/contact-detail/AIAssistant";
import { InsightsPanel } from "@/components/contact-detail/InsightsPanel";
import { TagsManager } from "@/components/contact-detail/TagsManager";
import { QuickNotes } from "@/components/contact-detail/QuickNotes";
import { CommunicationTabs } from "@/components/contact-detail/CommunicationTabs";
import { toast } from "sonner";

const ContactDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [contact, setContact] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [emails, setEmails] = useState<any[]>([]);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [timeline, setTimeline] = useState<any[]>([]);

  useEffect(() => {
    if (id) {
      loadContactData(id);
    }
  }, [id]);

  const loadContactData = async (contactId: string) => {
    try {
      setLoading(true);

      // Load contact details
      const { data: contactData, error: contactError } = await supabase
        .from("contacts")
        .select("*")
        .eq("id", contactId)
        .single();

      if (contactError) throw contactError;
      setContact(contactData);

      // Load conversation and messages
      const { data: conversationData } = await supabase
        .from("conversations")
        .select("id")
        .eq("contact_id", contactId)
        .maybeSingle();

      let messagesData: any[] = [];
      if (conversationData) {
        const { data } = await supabase
          .from("messages")
          .select("*")
          .eq("conversation_id", conversationData.id)
          .order("created_at", { ascending: true });
        
        messagesData = data || [];
        setMessages(messagesData);
      }

      // Load AI messages (emails)
      const { data: aiMessagesData } = await supabase
        .from("ai_messages")
        .select("*")
        .eq("contact_id", contactId)
        .eq("channel", "email")
        .order("sent_at", { ascending: false });
      
      setEmails(aiMessagesData || []);

      // Load purchases with product details
      const { data: purchasesData } = await supabase
        .from("purchases")
        .select("*, products(*)")
        .eq("contact_id", contactId)
        .order("purchase_date", { ascending: false });
      
      setPurchases(purchasesData || []);

      // Build timeline from all events
      const timelineEvents = [];
      
      // Add messages to timeline
      messagesData.forEach((msg: any) => {
        timelineEvents.push({
          id: msg.id,
          type: "message" as const,
          title: msg.direction === "inbound" ? "Received SMS" : "Sent SMS",
          description: msg.body,
          timestamp: msg.created_at
        });
      });

      // Add emails to timeline
      (aiMessagesData || []).forEach((email: any) => {
        timelineEvents.push({
          id: email.id,
          type: "email" as const,
          title: "Sent Email",
          description: email.subject,
          timestamp: email.sent_at
        });
      });

      // Add purchases to timeline
      (purchasesData || []).forEach((purchase: any) => {
        timelineEvents.push({
          id: purchase.id,
          type: "purchase" as const,
          title: "Purchase",
          description: `${purchase.products?.name} - $${purchase.amount}`,
          timestamp: purchase.purchase_date
        });
      });

      // Sort timeline by date
      timelineEvents.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setTimeline(timelineEvents);

    } catch (error: any) {
      console.error("Error loading contact:", error);
      toast.error("Failed to load contact details");
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async (message: string) => {
    toast.info("Message sending functionality coming soon");
  };

  const handleSaveNotes = async (notes: string) => {
    if (!id) return;
    
    try {
      const { error } = await supabase
        .from("contacts")
        .update({ notes })
        .eq("id", id);

      if (error) throw error;
      toast.success("Notes saved");
      setContact({ ...contact, notes });
    } catch (error: any) {
      toast.error("Failed to save notes");
    }
  };

  if (!id) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground">Contact not found</p>
        <Button onClick={() => navigate("/contacts")} className="mt-4">
          Back to Contacts
        </Button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!contact) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground">Contact not found</p>
        <Button onClick={() => navigate("/contacts")} className="mt-4">
          Back to Contacts
        </Button>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="border-b bg-background px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/contacts")}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Contacts
          </Button>
          <h1 className="text-xl font-semibold">{contact.full_name}</h1>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/contacts")}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* 3-Column Layout */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full grid grid-cols-[300px_1fr_320px] gap-0">
          {/* Left Sidebar - Quick Info */}
          <div className="border-r bg-muted/30 overflow-y-auto p-4 space-y-4">
            <ContactQuickInfo contact={contact} />
            <KeyMetrics
              leadScore={contact.lead_score}
              engagementScore={contact.engagement_score}
              totalSpent={contact.total_spent}
              leadStatus={contact.lead_status}
              lastContactDate={contact.last_contact_date}
            />
            <ProductsList purchases={purchases} />
            <TradingProfile
              tradingExperience={contact.trading_experience}
              tradingStyle={contact.trading_style}
              accountSize={contact.account_size}
              assetsTraded={contact.assets_traded}
              riskTolerance={contact.risk_tolerance}
            />
            <SourceAttribution
              leadSource={contact.lead_source}
              utmCampaign={contact.utm_campaign}
              referrer={contact.referrer}
              createdAt={contact.created_at}
            />
          </div>

          {/* Center - Communication Area */}
          <div className="bg-background flex flex-col">
            <CommunicationTabs
              messages={messages}
              emails={emails}
              timeline={timeline}
              onSendMessage={handleSendMessage}
            />
          </div>

          {/* Right Sidebar - Actions & AI */}
          <div className="border-l bg-muted/30 overflow-y-auto p-4 space-y-4">
            <QuickActions />
            <AIAssistant />
            <InsightsPanel />
            <TagsManager tags={contact.tags} />
            <QuickNotes notes={contact.notes} onSave={handleSaveNotes} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContactDetail;
