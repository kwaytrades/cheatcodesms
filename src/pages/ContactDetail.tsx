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
  customer_profile: {
    income?: string;
    interest_level?: string;
    trading_preferences?: string;
    [key: string]: any;
  } | null;
  ai_profile: {
    complaints?: string[];
    interests?: string[];
    preferences?: { [key: string]: string };
    important_notes?: string[];
  } | null;
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
      setContact(contactData as Contact);

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
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="messages">
                <MessageSquare className="h-4 w-4 mr-2" />
                Messages ({messages.length})
              </TabsTrigger>
              <TabsTrigger value="profile">Profile</TabsTrigger>
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

            <TabsContent value="profile" className="space-y-4">
              {/* Tags */}
              {contact.tags && contact.tags.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Tags</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {contact.tags.map((tag, idx) => (
                        <Badge key={idx} variant="secondary">{tag}</Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Customer Profile from Monday CRM */}
              {contact.customer_profile && Object.keys(contact.customer_profile).length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Customer Profile</CardTitle>
                    <CardDescription>Imported from Monday CRM</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {contact.customer_profile.income && (
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Income</p>
                        <p className="text-sm">{contact.customer_profile.income}</p>
                      </div>
                    )}
                    {contact.customer_profile.interest_level && (
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Interest Level</p>
                        <p className="text-sm">{contact.customer_profile.interest_level}</p>
                      </div>
                    )}
                    {contact.customer_profile.trading_preferences && (
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Trading Preferences</p>
                        <p className="text-sm">{contact.customer_profile.trading_preferences}</p>
                      </div>
                    )}
                    {Object.entries(contact.customer_profile)
                      .filter(([key]) => !['income', 'interest_level', 'trading_preferences'].includes(key))
                      .map(([key, value]) => (
                        <div key={key}>
                          <p className="text-sm font-medium text-muted-foreground capitalize">
                            {key.replace(/_/g, ' ')}
                          </p>
                          <p className="text-sm">{String(value)}</p>
                        </div>
                      ))}
                  </CardContent>
                </Card>
              )}

              {/* AI Customer Profile */}
              {contact.ai_profile && (
                <Card>
                  <CardHeader>
                    <CardTitle>AI Insights</CardTitle>
                    <CardDescription>Gathered from conversations</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {contact.ai_profile.interests && contact.ai_profile.interests.length > 0 && (
                      <div>
                        <p className="text-sm font-medium mb-2">Interests</p>
                        <div className="flex flex-wrap gap-2">
                          {contact.ai_profile.interests.map((interest, idx) => (
                            <Badge key={idx} variant="outline">{interest}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    {contact.ai_profile.complaints && contact.ai_profile.complaints.length > 0 && (
                      <div>
                        <p className="text-sm font-medium mb-2">Complaints</p>
                        <ul className="list-disc list-inside space-y-1">
                          {contact.ai_profile.complaints.map((complaint, idx) => (
                            <li key={idx} className="text-sm text-muted-foreground">{complaint}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {contact.ai_profile.preferences && Object.keys(contact.ai_profile.preferences).length > 0 && (
                      <div>
                        <p className="text-sm font-medium mb-2">Preferences</p>
                        <div className="space-y-2">
                          {Object.entries(contact.ai_profile.preferences).map(([key, value]) => (
                            <div key={key} className="flex justify-between text-sm">
                              <span className="text-muted-foreground capitalize">{key.replace(/_/g, ' ')}</span>
                              <span className="font-medium">{value}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {contact.ai_profile.important_notes && contact.ai_profile.important_notes.length > 0 && (
                      <div>
                        <p className="text-sm font-medium mb-2">Important Notes</p>
                        <ul className="list-disc list-inside space-y-1">
                          {contact.ai_profile.important_notes.map((note, idx) => (
                            <li key={idx} className="text-sm text-muted-foreground">{note}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {(!contact.ai_profile.interests || contact.ai_profile.interests.length === 0) &&
                     (!contact.ai_profile.complaints || contact.ai_profile.complaints.length === 0) &&
                     (!contact.ai_profile.preferences || Object.keys(contact.ai_profile.preferences).length === 0) &&
                     (!contact.ai_profile.important_notes || contact.ai_profile.important_notes.length === 0) && (
                      <p className="text-sm text-muted-foreground">No AI insights yet</p>
                    )}
                  </CardContent>
                </Card>
              )}

              {!contact.tags?.length && !contact.customer_profile && !contact.ai_profile && (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    No profile information available yet
                  </CardContent>
                </Card>
              )}
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
