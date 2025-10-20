import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Search, Bot, User } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { ContactDetailPanel } from "@/components/ContactDetailPanel";

interface Conversation {
  id: string;
  phone_number: string;
  contact_name: string | null;
  contact_id: string | null;
  status: string;
  assigned_agent: string;
  last_message_at: string | null;
}

interface Message {
  id: string;
  direction: string;
  sender: string;
  body: string;
  created_at: string;
}

const Inbox = () => {
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [contactInfo, setContactInfo] = useState<any>(null);
  const [showContactPanel, setShowContactPanel] = useState(false);

  useEffect(() => {
    loadConversations();
    
    // Subscribe to new messages - works regardless of selected conversation
    const messagesChannel = supabase
      .channel('messages-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages'
        },
        (payload) => {
          console.log('New message received:', payload);
          // Reload conversations to update last_message_at
          loadConversations();
          // If viewing the conversation where the message was added, reload messages
          if (selectedConversation && payload.new.conversation_id === selectedConversation.id) {
            loadMessages(selectedConversation.id);
          }
        }
      )
      .subscribe();

    // Subscribe to conversation updates
    const conversationsChannel = supabase
      .channel('conversations-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'conversations'
        },
        () => {
          console.log('Conversation updated');
          loadConversations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(messagesChannel);
      supabase.removeChannel(conversationsChannel);
    };
  }, [selectedConversation]);

  const loadConversations = async () => {
    try {
      const { data, error } = await supabase
        .from("conversations")
        .select("*")
        .order("last_message_at", { ascending: false, nullsFirst: false });

      if (error) throw error;
      setConversations(data || []);
    } catch (error) {
      console.error("Error loading conversations:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (conversationId: string) => {
    try {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      setMessages(data || []);
    } catch (error) {
      console.error("Error loading messages:", error);
    }
  };

  const handleConversationClick = async (conversation: Conversation) => {
    setSelectedConversation(conversation);
    loadMessages(conversation.id);
    
    // Load contact info if linked
    if (conversation.contact_id) {
      try {
        const { data, error } = await supabase
          .from("contacts")
          .select("*")
          .eq("id", conversation.contact_id)
          .single();
        
        if (error) throw error;
        setContactInfo(data);
        setShowContactPanel(true);
      } catch (error) {
        console.error("Error loading contact:", error);
        setContactInfo(null);
        setShowContactPanel(false);
      }
    } else {
      setContactInfo(null);
      setShowContactPanel(false);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation || sending) return;

    setSending(true);
    try {
      // Insert message into database
      const { error } = await supabase.from("messages").insert({
        conversation_id: selectedConversation.id,
        direction: "outbound",
        sender: "human_team",
        body: newMessage.trim(),
        status: "sent",
      });

      if (error) throw error;

      // TODO: Actually send via Twilio through edge function
      toast.success("Message sent!");
      setNewMessage("");
      loadMessages(selectedConversation.id);
    } catch (error: any) {
      toast.error(error.message || "Failed to send message");
    } finally {
      setSending(false);
    }
  };

  const getSenderIcon = (sender: string) => {
    if (sender.includes("ai")) {
      return <Bot className="h-4 w-4 text-primary" />;
    } else if (sender === "human_team") {
      return <User className="h-4 w-4 text-secondary" />;
    }
    return null;
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse">Loading inbox...</div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      <div className="border-b border-border/50 p-4">
        <h1 className="text-2xl font-bold">Inbox</h1>
        <p className="text-sm text-muted-foreground">Manage customer conversations</p>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <ResizablePanelGroup direction="horizontal" className="flex-1">
          {/* Conversations List */}
          <ResizablePanel defaultSize={20} minSize={15} maxSize={30}>
            <div className="h-full border-r border-border/50 flex flex-col">
          <div className="p-4 border-b border-border/50">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search conversations..." className="pl-9" />
            </div>
          </div>

          <ScrollArea className="flex-1">
            {conversations.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground">
                No conversations yet
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {conversations.map((conv) => (
                  <div
                    key={conv.id}
                    onClick={() => handleConversationClick(conv)}
                    className={`p-4 cursor-pointer hover:bg-muted/50 transition-colors ${
                      selectedConversation?.id === conv.id ? "bg-muted" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between mb-1">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold truncate">
                          {conv.contact_name || conv.phone_number}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {conv.phone_number}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-xs ml-2">
                        {conv.status}
                      </Badge>
                    </div>
                    {conv.last_message_at && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {format(new Date(conv.last_message_at), "MMM d, h:mm a")}
                      </p>
                    )}
                  </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>
    </ResizablePanel>

    <ResizableHandle />

    {/* Messages Area */}
    <ResizablePanel defaultSize={showContactPanel ? 50 : 80}>
      <div className="h-full flex flex-col">
          {selectedConversation ? (
            <>
              {/* Message Header */}
              <div className="p-4 border-b border-border/50">
                <div className="flex items-center justify-between">
                  <div>
                    <button
                      onClick={() => {
                        if (contactInfo) {
                          setShowContactPanel(true);
                        }
                      }}
                      disabled={!contactInfo}
                      className={`text-left ${contactInfo ? 'hover:underline cursor-pointer' : 'cursor-default'}`}
                    >
                      <h2 className="font-semibold">
                        {selectedConversation.contact_name || selectedConversation.phone_number}
                      </h2>
                      <p className="text-xs text-muted-foreground">
                        {selectedConversation.phone_number}
                      </p>
                    </button>
                    <p className="text-sm text-muted-foreground mt-1">
                      Agent: {selectedConversation.assigned_agent.replace("_", " ")}
                    </p>
                  </div>
                  {contactInfo && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowContactPanel(!showContactPanel)}
                    >
                      {showContactPanel ? 'Hide' : 'Show'} Profile
                    </Button>
                  )}
                </div>
                {contactInfo && (
                  <div className="mt-3 pt-3 border-t border-border/50 space-y-1">
                    {contactInfo.email && (
                      <p className="text-xs text-muted-foreground">📧 {contactInfo.email}</p>
                    )}
                    {contactInfo.status && (
                      <p className="text-xs text-muted-foreground">Status: {contactInfo.status}</p>
                    )}
                    {contactInfo.products_owned && contactInfo.products_owned.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Products: {contactInfo.products_owned.join(', ')}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Messages */}
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-4">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${
                        message.direction === "outbound" ? "justify-end" : "justify-start"
                      }`}
                    >
                      <div
                        className={`max-w-[70%] rounded-lg p-3 ${
                          message.direction === "outbound"
                            ? "bg-primary/10 text-foreground"
                            : "bg-muted"
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          {getSenderIcon(message.sender)}
                          <span className="text-xs text-muted-foreground">
                            {message.sender.replace("_", " ")}
                          </span>
                        </div>
                        <p className="text-sm">{message.body}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {format(new Date(message.created_at), "h:mm a")}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>

              {/* Message Input */}
              <div className="p-4 border-t border-border/50">
                <div className="flex gap-2">
                  <Input
                    placeholder="Type your message..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
                    disabled={sending}
                  />
                  <Button onClick={handleSendMessage} disabled={sending}>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              Select a conversation to view messages
            </div>
          )}
        </div>
      </ResizablePanel>

      {/* Contact Detail Sidebar */}
      {showContactPanel && contactInfo && (
        <>
          <ResizableHandle />
          <ResizablePanel defaultSize={30} minSize={25} maxSize={40}>
            <ContactDetailPanel 
              contactId={contactInfo.id}
              onClose={() => setShowContactPanel(false)}
              showExpandButton={true}
              hideSMSTab={true}
            />
          </ResizablePanel>
        </>
      )}
    </ResizablePanelGroup>
      </div>
    </div>
  );
};

export default Inbox;
