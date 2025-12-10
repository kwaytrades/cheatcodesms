import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState, useRef } from "react";
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
import { ProductAgentPanel } from "@/components/contact-detail/ProductAgentPanel";
import { toast } from "sonner";

const ContactDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [contact, setContact] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [agentMessages, setAgentMessages] = useState<any[]>([]);
  const [emails, setEmails] = useState<any[]>([]);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [activeAgentType, setActiveAgentType] = useState<string | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const messageIdCounter = useRef(0);

  useEffect(() => {
    if (id) {
      loadContactData(id);
    }
  }, [id]);

  // Set up real-time subscription for agent messages
  useEffect(() => {
    if (!id) return;

    const setupRealtimeSubscription = async () => {
      // Subscribe to agent_messages via agent_conversations
      const { data: agentConv } = await supabase
        .from("agent_conversations")
        .select("id")
        .eq("contact_id", id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (agentConv) {
        const channel = supabase
          .channel(`agent-messages-${agentConv.id}`)
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'agent_messages',
              filter: `conversation_id=eq.${agentConv.id}`
            },
            (payload) => {
              console.log('New agent message received:', payload);
              const newMsg = payload.new as any;
              setAgentMessages((prev) => [...prev, {
                id: newMsg.id,
                body: newMsg.content,
                created_at: newMsg.created_at,
                direction: newMsg.role === 'user' ? 'outbound' : 'inbound',
                sender: newMsg.role === 'assistant' ? 'ai_agent' : 'user'
              }]);
            }
          )
          .subscribe();

        return () => {
          supabase.removeChannel(channel);
        };
      }
    };

    setupRealtimeSubscription();
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

      // Load conversation and messages from live SMS - query by phone number to get ALL conversations
      const contactPhone = contactData.phone_number;
      let messagesData: any[] = [];
      
      if (contactPhone) {
        // Handle phone number format variations (+17038630655, 7038630655, etc.)
        const phoneVariations = [
          contactPhone,
          contactPhone.startsWith('+1') ? contactPhone.slice(2) : `+1${contactPhone}`,
          contactPhone.replace(/^\+1/, '')
        ];

        const { data: conversationsData } = await supabase
          .from("conversations")
          .select("id")
          .in("phone_number", phoneVariations)
          .order("created_at", { ascending: false });

        // Get ALL conversation IDs for this phone number
        const conversationIds = conversationsData?.map(c => c.id) || [];

        // Fetch messages from ALL conversations
        if (conversationIds.length > 0) {
          const { data: liveMessages } = await supabase
            .from("messages")
            .select("*")
            .in("conversation_id", conversationIds)
            .order("created_at", { ascending: true });
          
          messagesData = liveMessages || [];
        }
      }
      
      setMessages(messagesData);

      // Load agent conversation messages (internal chat with AI agents)
      const { data: agentConvData } = await supabase
        .from("agent_conversations")
        .select("id, agent_type")
        .eq("contact_id", contactId)
        .order("last_message_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (agentConvData) {
        setActiveAgentType(agentConvData.agent_type);
        
        const { data: agentMsgs } = await supabase
          .from("agent_messages")
          .select("*")
          .eq("conversation_id", agentConvData.id)
          .order("created_at", { ascending: true });

        // Convert agent_messages to the same format as SMS messages
        const formattedAgentMsgs = (agentMsgs || []).map((msg: any) => ({
          id: msg.id,
          body: msg.content,
          created_at: msg.created_at,
          direction: msg.role === 'user' ? 'outbound' : 'inbound',
          sender: msg.role === 'assistant' ? 'ai_agent' : 'user',
          agent_type: agentConvData.agent_type
        }));
        
        setAgentMessages(formattedAgentMsgs);
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
    if (!id || !message.trim()) return;

    try {
      // Determine agent type - use active agent or default to customer_service
      const agentToUse = activeAgentType || "customer_service";
      
      // Create stable timestamp for user message
      const userMsgTimestamp = new Date().toISOString();
      messageIdCounter.current += 1;
      
      // Optimistically add user message to UI with stable ID
      const tempUserMsg = {
        id: `user-${messageIdCounter.current}-${Date.now()}`,
        body: message.trim(),
        created_at: userMsgTimestamp,
        direction: 'outbound',
        sender: 'user',
        agent_type: agentToUse
      };
      setAgentMessages(prev => [...prev, tempUserMsg]);
      
      // Show typing indicator
      setIsTyping(true);

      // Call agent-chat function
      const { data: response, error: chatError } = await supabase.functions.invoke(
        "agent-chat",
        {
          body: {
            contactId: id,
            agentType: agentToUse,
            message: message.trim(),
          },
        }
      );

      // Hide typing indicator
      setIsTyping(false);

      if (chatError) throw chatError;

      // Add AI response to messages with timestamp AFTER user message
      if (response?.response) {
        messageIdCounter.current += 1;
        const aiMsgTimestamp = new Date().toISOString();
        const aiMsg = {
          id: `ai-${messageIdCounter.current}-${Date.now()}`,
          body: response.response,
          created_at: aiMsgTimestamp,
          direction: 'inbound',
          sender: 'ai_agent',
          agent_type: agentToUse
        };
        setAgentMessages(prev => [...prev, aiMsg]);
      }

      // Refresh agent messages to get actual DB records
      const { data: agentConvData } = await supabase
        .from("agent_conversations")
        .select("id, agent_type")
        .eq("contact_id", id)
        .order("last_message_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (agentConvData) {
        setActiveAgentType(agentConvData.agent_type);
        
        const { data: agentMsgs } = await supabase
          .from("agent_messages")
          .select("*")
          .eq("conversation_id", agentConvData.id)
          .order("created_at", { ascending: true });

        const formattedAgentMsgs = (agentMsgs || []).map((msg: any) => ({
          id: msg.id,
          body: msg.content,
          created_at: msg.created_at,
          direction: msg.role === 'user' ? 'outbound' : 'inbound',
          sender: msg.role === 'assistant' ? 'ai_agent' : 'user',
          agent_type: agentConvData.agent_type
        }));
        
        setAgentMessages(formattedAgentMsgs);
      }

      toast.success("Message sent");
    } catch (error: any) {
      console.error("Error sending message:", error);
      setIsTyping(false);
      
      if (error.message?.includes('Rate limit')) {
        toast.error("Too many requests. Please wait a moment and try again.");
      } else if (error.message?.includes('Payment required') || error.message?.includes('AI service')) {
        toast.error("AI service unavailable. Please contact support.");
      } else {
        toast.error("Failed to send message: " + (error.message || "Unknown error"));
      }
    }
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
              contactId={id!}
              likelihoodScore={contact.likelihood_to_buy_score}
              engagementLevel={contact.likelihood_category}
              totalSpent={contact.total_spent}
              leadStatus={contact.lead_status}
              customerTier={contact.customer_tier}
              lastContactDate={contact.last_contact_date}
              productsCount={contact.products_owned?.length || 0}
              webinarCount={contact.webinar_attendance?.length || 0}
              lastScoreUpdate={contact.last_score_update}
              onScoreRefresh={() => loadContactData(id!)}
            />
            <ProductsList 
              contactId={id!}
              totalSpent={contact.total_spent}
            />
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
              messages={[...messages, ...agentMessages].sort((a, b) => 
                new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
              )}
              emails={emails}
              timeline={timeline}
              onSendMessage={handleSendMessage}
              contactId={id}
              activeAgentType={activeAgentType}
              isTyping={isTyping}
            />
          </div>

          {/* Right Sidebar - Actions & AI */}
          <div className="border-l bg-muted/30 overflow-y-auto p-4 space-y-4">
            <QuickActions />
            <AIAssistant />
            <InsightsPanel 
              contact={contact}
              purchases={purchases}
              messages={messages}
              aiMessages={emails}
            />
            <ProductAgentPanel contactId={id} />
            <TagsManager tags={contact.tags} />
            <QuickNotes notes={contact.notes} onSave={handleSaveNotes} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContactDetail;
