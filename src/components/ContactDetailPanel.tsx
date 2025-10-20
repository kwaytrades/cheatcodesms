import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { X, Mail, Phone, DollarSign, TrendingUp, Calendar, Tag, ShoppingBag, Maximize2, Sparkles, MessageSquare, Bot, User, CheckCheck } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

interface ContactDetailPanelProps {
  contactId: string;
  onClose?: () => void;
  showExpandButton?: boolean;
}

interface Message {
  id: string;
  body: string;
  sender: string;
  direction: string;
  created_at: string;
  status: string;
}

export function ContactDetailPanel({ contactId, onClose, showExpandButton = false }: ContactDetailPanelProps) {
  const navigate = useNavigate();
  const [contact, setContact] = useState<any>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [aiMessages, setAiMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadContactDetails();
  }, [contactId]);

  const loadContactDetails = async () => {
    try {
      setLoading(true);
      
      // Load contact
      const { data: contactData, error: contactError } = await supabase
        .from('contacts')
        .select('*')
        .eq('id', contactId)
        .single();

      if (contactError) throw contactError;
      setContact(contactData);

      // Load conversation and messages
      const { data: conversationData } = await supabase
        .from('conversations')
        .select('id')
        .eq('contact_id', contactId)
        .maybeSingle();

      if (conversationData) {
        const { data: messagesData } = await supabase
          .from('messages')
          .select('*')
          .eq('conversation_id', conversationData.id)
          .order('created_at', { ascending: true });
        
        setMessages(messagesData || []);
      }

      // Load purchases
      const { data: purchasesData } = await supabase
        .from('purchases')
        .select('*, products(*)')
        .eq('contact_id', contactId)
        .order('purchase_date', { ascending: false });

      setPurchases(purchasesData || []);

      // Load AI messages
      const { data: aiMessagesData } = await supabase
        .from('ai_messages')
        .select('*')
        .eq('contact_id', contactId)
        .order('sent_at', { ascending: false });

      setAiMessages(aiMessagesData || []);

    } catch (error) {
      console.error('Error loading contact details:', error);
      toast.error('Failed to load contact details');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!contact) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-muted-foreground">Contact not found</p>
      </div>
    );
  }

  const emailMessages = aiMessages.filter(m => m.channel === 'email');
  const smsAiMessages = aiMessages.filter(m => m.channel === 'sms');

  // Combine all communications for timeline
  const allCommunications = [
    ...messages.map(m => ({ type: 'sms', data: m, timestamp: m.created_at })),
    ...aiMessages.map(m => ({ type: 'ai_message', data: m, timestamp: m.sent_at })),
    ...purchases.map(p => ({ type: 'purchase', data: p, timestamp: p.purchase_date })),
  ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return (
    <div className="h-full flex flex-col border-l bg-background">
      {/* Header */}
      <div className="p-4 border-b flex items-center justify-between bg-card">
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-semibold truncate">{contact.full_name}</h2>
          <div className="flex flex-wrap gap-1 mt-1">
            {contact.lead_status && (
              <Badge variant="secondary" className="text-xs">{contact.lead_status}</Badge>
            )}
            {contact.tags?.slice(0, 2).map((tag: string) => (
              <Badge key={tag} variant="outline" className="text-xs">
                <Tag className="h-3 w-3 mr-1" />
                {tag}
              </Badge>
            ))}
          </div>
        </div>
        <div className="flex gap-1 ml-2">
          {showExpandButton && (
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => navigate(`/contacts/${contactId}`)}
              title="Open in full screen"
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
          )}
          {onClose && (
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {/* Overview Card - Compact Info + Metrics */}
          <Card>
            <CardContent className="p-4">
              <div className="grid grid-cols-2 gap-4">
                {/* Contact Info */}
                <div className="space-y-2">
                  {contact.email && (
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                      <span className="truncate">{contact.email}</span>
                    </div>
                  )}
                  {contact.phone_number && (
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                      <span>{contact.phone_number}</span>
                    </div>
                  )}
                  {contact.last_contact_date && (
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                      <span className="text-xs text-muted-foreground">
                        {new Date(contact.last_contact_date).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </div>

                {/* Key Metrics */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="text-center p-2 bg-muted/50 rounded">
                    <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground mb-1">
                      <TrendingUp className="h-3 w-3" />
                      <span>Score</span>
                    </div>
                    <p className="text-lg font-bold">{contact.lead_score || 0}</p>
                  </div>
                  <div className="text-center p-2 bg-muted/50 rounded">
                    <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground mb-1">
                      <DollarSign className="h-3 w-3" />
                      <span>Spent</span>
                    </div>
                    <p className="text-lg font-bold">${contact.total_spent || 0}</p>
                  </div>
                  {contact.engagement_score !== undefined && (
                    <div className="text-center p-2 bg-muted/50 rounded col-span-2">
                      <p className="text-xs text-muted-foreground mb-1">Engagement</p>
                      <p className="text-lg font-bold">{contact.engagement_score}</p>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Purchases Summary - Inline */}
          {purchases.length > 0 && (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <ShoppingBag className="h-4 w-4 text-muted-foreground" />
                    <span className="font-semibold text-sm">Recent Purchases</span>
                  </div>
                  <Badge variant="secondary">{purchases.length}</Badge>
                </div>
                <div className="space-y-2">
                  {purchases.slice(0, 3).map((purchase) => (
                    <div key={purchase.id} className="flex items-center justify-between text-sm py-1">
                      <span className="truncate">{purchase.products?.name || 'Product'}</span>
                      <span className="font-semibold text-primary ml-2">${purchase.amount}</span>
                    </div>
                  ))}
                </div>
                {purchases.length > 3 && (
                  <p className="text-xs text-muted-foreground mt-2">
                    +{purchases.length - 3} more
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Trading Profile - Compact */}
          {contact.trading_experience && (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  <span className="font-semibold text-sm">Trading Profile</span>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <div>
                    <span className="text-xs text-muted-foreground">Experience</span>
                    <p className="font-medium">{contact.trading_experience}</p>
                  </div>
                  {contact.trading_style && (
                    <div>
                      <span className="text-xs text-muted-foreground">Style</span>
                      <p className="font-medium">{contact.trading_style}</p>
                    </div>
                  )}
                  {contact.account_size && (
                    <div>
                      <span className="text-xs text-muted-foreground">Account Size</span>
                      <p className="font-medium">{contact.account_size}</p>
                    </div>
                  )}
                  {contact.risk_tolerance && (
                    <div>
                      <span className="text-xs text-muted-foreground">Risk Tolerance</span>
                      <p className="font-medium">{contact.risk_tolerance}</p>
                    </div>
                  )}
                </div>
                {contact.assets_traded && contact.assets_traded.length > 0 && (
                  <div className="mt-3">
                    <span className="text-xs text-muted-foreground">Assets</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {contact.assets_traded.map((asset: string) => (
                        <Badge key={asset} variant="outline" className="text-xs">
                          {asset}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* AI Profile - Compact */}
          {contact.ai_profile && Object.keys(contact.ai_profile).length > 0 && (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <span className="font-semibold text-sm">AI Profile Analysis</span>
                </div>
                <div className="space-y-2 text-sm">
                  {Object.entries(contact.ai_profile).slice(0, 4).map(([key, value]) => (
                    <div key={key} className="flex justify-between gap-2">
                      <span className="text-muted-foreground text-xs capitalize">
                        {key.replace(/_/g, ' ')}:
                      </span>
                      <span className="font-medium text-xs text-right">{String(value)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Customer Profile */}
          {contact.customer_profile && Object.keys(contact.customer_profile).length > 0 && (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="font-semibold text-sm">Customer Profile</span>
                </div>
                <div className="space-y-2 text-sm">
                  {Object.entries(contact.customer_profile).slice(0, 4).map(([key, value]) => (
                    <div key={key} className="flex justify-between gap-2">
                      <span className="text-muted-foreground text-xs capitalize">
                        {key.replace(/_/g, ' ')}:
                      </span>
                      <span className="font-medium text-xs text-right">{String(value)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Communication History Tabs */}
          <Card>
            <Tabs defaultValue="sms" className="w-full">
              <CardContent className="p-0">
                <TabsList className="w-full rounded-none border-b">
                  <TabsTrigger value="sms" className="flex-1">
                    <MessageSquare className="h-4 w-4 mr-2" />
                    SMS/Chat
                  </TabsTrigger>
                  <TabsTrigger value="email" className="flex-1">
                    <Mail className="h-4 w-4 mr-2" />
                    Email
                  </TabsTrigger>
                  <TabsTrigger value="all" className="flex-1">
                    <Calendar className="h-4 w-4 mr-2" />
                    Timeline
                  </TabsTrigger>
                </TabsList>

                {/* SMS/Chat Tab */}
                <TabsContent value="sms" className="p-4 space-y-3 m-0">
                  {messages.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      No messages yet
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {messages.map((message) => (
                        <div
                          key={message.id}
                          className={`flex ${message.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`max-w-[85%] rounded-lg p-3 ${
                              message.direction === 'outbound'
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted'
                            }`}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              {message.sender === 'ai_bot' ? (
                                <Bot className="h-3 w-3" />
                              ) : message.direction === 'outbound' ? (
                                <User className="h-3 w-3" />
                              ) : (
                                <MessageSquare className="h-3 w-3" />
                              )}
                              <span className="text-xs font-medium capitalize">
                                {message.sender.replace('_', ' ')}
                              </span>
                            </div>
                            <p className="text-sm whitespace-pre-wrap break-words">
                              {message.body}
                            </p>
                            <div className="flex items-center gap-2 mt-2 text-xs opacity-70">
                              <span>
                                {new Date(message.created_at).toLocaleString()}
                              </span>
                              {message.status === 'delivered' && (
                                <CheckCheck className="h-3 w-3" />
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                {/* Email Tab */}
                <TabsContent value="email" className="p-4 space-y-2 m-0">
                  {emailMessages.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      No emails yet
                    </p>
                  ) : (
                    emailMessages.map((email) => (
                      <div key={email.id} className="border rounded-lg p-3 hover:bg-muted/50 transition-colors">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex-1 min-w-0">
                            {email.subject && (
                              <p className="font-medium text-sm truncate">{email.subject}</p>
                            )}
                            <p className="text-xs text-muted-foreground">
                              {new Date(email.sent_at).toLocaleString()}
                            </p>
                          </div>
                          <div className="flex gap-1">
                            {email.opened && (
                              <Badge variant="outline" className="text-xs">Opened</Badge>
                            )}
                            {email.replied && (
                              <Badge variant="outline" className="text-xs">Replied</Badge>
                            )}
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {email.message_body}
                        </p>
                      </div>
                    ))
                  )}
                </TabsContent>

                {/* Timeline Tab */}
                <TabsContent value="all" className="p-4 space-y-3 m-0">
                  {allCommunications.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      No activity yet
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {allCommunications.map((item, index) => (
                        <div key={`${item.type}-${index}`}>
                          {item.type === 'sms' && (
                            <div className="flex items-start gap-3">
                              <MessageSquare className="h-4 w-4 text-muted-foreground mt-1 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium">
                                  {item.data.direction === 'outbound' ? 'Sent Message' : 'Received Message'}
                                </p>
                                <p className="text-sm text-muted-foreground line-clamp-2">
                                  {item.data.body}
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {new Date(item.timestamp).toLocaleString()}
                                </p>
                              </div>
                            </div>
                          )}
                          {item.type === 'ai_message' && (
                            <div className="flex items-start gap-3">
                              <Mail className="h-4 w-4 text-muted-foreground mt-1 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium">
                                  {item.data.channel === 'email' ? 'Email Sent' : 'SMS Sent'}
                                </p>
                                {item.data.subject && (
                                  <p className="text-sm font-medium">{item.data.subject}</p>
                                )}
                                <p className="text-sm text-muted-foreground line-clamp-2">
                                  {item.data.message_body}
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {new Date(item.timestamp).toLocaleString()}
                                </p>
                              </div>
                            </div>
                          )}
                          {item.type === 'purchase' && (
                            <div className="flex items-start gap-3">
                              <ShoppingBag className="h-4 w-4 text-primary mt-1 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium">Purchase</p>
                                <p className="text-sm">{item.data.products?.name || 'Product'}</p>
                                <p className="text-sm text-primary font-semibold">
                                  ${item.data.amount}
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {new Date(item.timestamp).toLocaleString()}
                                </p>
                              </div>
                            </div>
                          )}
                          {index < allCommunications.length - 1 && (
                            <Separator className="my-3" />
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>
              </CardContent>
            </Tabs>
          </Card>

          {/* Notes */}
          {contact.notes && (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Tag className="h-4 w-4 text-muted-foreground" />
                  <span className="font-semibold text-sm">Notes</span>
                </div>
                <p className="text-sm text-muted-foreground">{contact.notes}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
