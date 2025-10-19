import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Mail, Phone, Calendar, TrendingUp, MessageSquare, Send } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

interface Contact {
  id: string;
  full_name: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone_number: string | null;
  status: string | null;
  lead_score: number | null;
  products_interested: string[] | null;
  products_owned: string[] | null;
  tags: string[] | null;
  notes: string | null;
  last_contact_date: string | null;
  engagement_score: number;
  created_at: string;
  monday_board_name: string | null;
}

interface Message {
  id: string;
  direction: string;
  sender: string;
  body: string;
  created_at: string;
}

interface Conversation {
  id: string;
  status: string;
  last_message_at: string | null;
}

const ContactDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [contact, setContact] = useState<Contact | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      loadContactData();
    }
  }, [id]);

  const loadContactData = async () => {
    try {
      // Load contact
      const { data: contactData, error: contactError } = await supabase
        .from("contacts")
        .select("*")
        .eq("id", id)
        .single();

      if (contactError) throw contactError;
      setContact(contactData);

      // Load conversations
      const { data: convData, error: convError } = await supabase
        .from("conversations")
        .select("*")
        .eq("contact_id", id);

      if (convError) throw convError;
      setConversations(convData || []);

      // Load all messages from all conversations
      if (convData && convData.length > 0) {
        const convIds = convData.map(c => c.id);
        const { data: msgData, error: msgError } = await supabase
          .from("messages")
          .select("*")
          .in("conversation_id", convIds)
          .order("created_at", { ascending: true });

        if (msgError) throw msgError;
        setMessages(msgData || []);
      }
    } catch (error) {
      console.error("Error loading contact:", error);
      toast.error("Failed to load contact details");
    } finally {
      setLoading(false);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map(n => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse">Loading contact...</div>
      </div>
    );
  }

  if (!contact) {
    return (
      <div className="p-8">
        <p>Contact not found</p>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => navigate("/contacts")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">{contact.full_name}</h1>
          <p className="text-muted-foreground">Contact details and history</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Contact Info */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarFallback className="bg-primary/10 text-primary font-semibold text-xl">
                    {getInitials(contact.full_name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <CardTitle>{contact.full_name}</CardTitle>
                  {contact.status && (
                    <Badge className="mt-1">{contact.status}</Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {contact.email && (
                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{contact.email}</span>
                </div>
              )}
              {contact.phone_number && (
                <div className="flex items-center gap-3">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{contact.phone_number}</span>
                </div>
              )}
              {contact.last_contact_date && (
                <div className="flex items-center gap-3">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">
                    Last contact: {format(new Date(contact.last_contact_date), 'MMM d, yyyy')}
                  </span>
                </div>
              )}
              <div className="flex items-center gap-3">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">Engagement score: {contact.engagement_score}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Products</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {contact.products_interested && contact.products_interested.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2">Interested In:</p>
                  <div className="flex flex-wrap gap-2">
                    {contact.products_interested.map((product, idx) => (
                      <Badge key={idx} variant="outline">{product}</Badge>
                    ))}
                  </div>
                </div>
              )}
              {contact.products_owned && contact.products_owned.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2">Owns:</p>
                  <div className="flex flex-wrap gap-2">
                    {contact.products_owned.map((product, idx) => (
                      <Badge key={idx} variant="default">{product}</Badge>
                    ))}
                  </div>
                </div>
              )}
              {(!contact.products_interested || contact.products_interested.length === 0) &&
               (!contact.products_owned || contact.products_owned.length === 0) && (
                <p className="text-sm text-muted-foreground">No products recorded</p>
              )}
            </CardContent>
          </Card>

          {contact.monday_board_name && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Source</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Synced from Monday.com board: <span className="font-medium text-foreground">{contact.monday_board_name}</span>
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column - Activity & Messages */}
        <div className="lg:col-span-2">
          <Tabs defaultValue="messages" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="messages">
                <MessageSquare className="h-4 w-4 mr-2" />
                Messages ({messages.length})
              </TabsTrigger>
              <TabsTrigger value="notes">Notes</TabsTrigger>
            </TabsList>

            <TabsContent value="messages" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Conversation History</CardTitle>
                  <CardDescription>
                    {conversations.length} conversation(s) · {messages.length} message(s)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {messages.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p>No messages yet</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {messages.map((message) => (
                        <div
                          key={message.id}
                          className={`flex ${message.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`max-w-[80%] rounded-lg p-3 ${
                              message.direction === 'outbound'
                                ? 'bg-primary/10'
                                : 'bg-muted'
                            }`}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-medium">
                                {message.sender.replace('_', ' ')}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {format(new Date(message.created_at), 'MMM d, h:mm a')}
                              </span>
                            </div>
                            <p className="text-sm">{message.body}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="notes">
              <Card>
                <CardHeader>
                  <CardTitle>Notes</CardTitle>
                </CardHeader>
                <CardContent>
                  {contact.notes ? (
                    <p className="text-sm whitespace-pre-wrap">{contact.notes}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground">No notes added</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default ContactDetail;
