import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { X, Mail, Phone, DollarSign, TrendingUp, Calendar, Tag, ShoppingBag, Maximize2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

interface ContactDetailPanelProps {
  contactId: string;
  onClose?: () => void;
  showExpandButton?: boolean;
}

export function ContactDetailPanel({ contactId, onClose, showExpandButton = false }: ContactDetailPanelProps) {
  const navigate = useNavigate();
  const [contact, setContact] = useState<any>(null);
  const [activities, setActivities] = useState<any[]>([]);
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

      // Load activities
      const { data: activitiesData, error: activitiesError } = await supabase
        .from('contact_activities')
        .select('*')
        .eq('contact_id', contactId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (activitiesError) throw activitiesError;
      setActivities(activitiesData || []);

      // Load purchases
      const { data: purchasesData, error: purchasesError } = await supabase
        .from('purchases')
        .select('*, products(*)')
        .eq('contact_id', contactId)
        .order('purchase_date', { ascending: false });

      if (purchasesError) throw purchasesError;
      setPurchases(purchasesData || []);

      // Load AI messages
      const { data: aiMessagesData, error: aiMessagesError } = await supabase
        .from('ai_messages')
        .select('*')
        .eq('contact_id', contactId)
        .order('sent_at', { ascending: false })
        .limit(5);

      if (aiMessagesError) throw aiMessagesError;
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

  return (
    <div className="h-full flex flex-col border-l bg-card">
      <div className="p-4 border-b flex items-center justify-between">
        <h3 className="font-semibold">Contact Details</h3>
        <div className="flex gap-2">
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
        <div className="p-4 space-y-6">
          {/* Header */}
          <div className="space-y-2">
            <h2 className="text-2xl font-bold">{contact.full_name}</h2>
            <div className="flex flex-wrap gap-2">
              {contact.lead_status && (
                <Badge variant="secondary">{contact.lead_status}</Badge>
              )}
              {contact.tags?.map((tag: string) => (
                <Badge key={tag} variant="outline">
                  <Tag className="h-3 w-3 mr-1" />
                  {tag}
                </Badge>
              ))}
            </div>
          </div>

          {/* Contact Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Contact Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {contact.email && (
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span>{contact.email}</span>
                </div>
              )}
              {contact.phone_number && (
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span>{contact.phone_number}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Key Metrics */}
          <div className="grid grid-cols-2 gap-3">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  <div>
                    <p className="text-xs text-muted-foreground">Lead Score</p>
                    <p className="text-2xl font-bold">{contact.lead_score || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-primary" />
                  <div>
                    <p className="text-xs text-muted-foreground">Total Spent</p>
                    <p className="text-2xl font-bold">${contact.total_spent || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Trading Info */}
          {contact.trading_experience && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Trading Profile</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Experience:</span>
                  <span className="ml-2 font-medium">{contact.trading_experience}</span>
                </div>
                {contact.trading_style && (
                  <div>
                    <span className="text-muted-foreground">Style:</span>
                    <span className="ml-2 font-medium">{contact.trading_style}</span>
                  </div>
                )}
                {contact.account_size && (
                  <div>
                    <span className="text-muted-foreground">Account Size:</span>
                    <span className="ml-2 font-medium">{contact.account_size}</span>
                  </div>
                )}
                {contact.assets_traded && contact.assets_traded.length > 0 && (
                  <div>
                    <span className="text-muted-foreground">Assets:</span>
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

          {/* AI Profile Notes */}
          {contact.ai_profile && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <CardTitle className="text-sm">AI Profile Analysis</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {Object.entries(contact.ai_profile).map(([key, value]) => (
                  <div key={key}>
                    <span className="text-muted-foreground capitalize">{key.replace(/_/g, ' ')}:</span>
                    <span className="ml-2 font-medium">{String(value)}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Customer Profile */}
          {contact.customer_profile && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Customer Profile</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {Object.entries(contact.customer_profile).map(([key, value]) => (
                  <div key={key}>
                    <span className="text-muted-foreground capitalize">{key.replace(/_/g, ' ')}:</span>
                    <span className="ml-2 font-medium">{String(value)}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Tabs */}
          <Tabs defaultValue="activity" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="activity">Activity</TabsTrigger>
              <TabsTrigger value="purchases">Purchases</TabsTrigger>
              <TabsTrigger value="ai">AI Messages</TabsTrigger>
            </TabsList>

            <TabsContent value="activity" className="space-y-2">
              {activities.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No activity yet
                </p>
              ) : (
                activities.map((activity) => (
                  <Card key={activity.id}>
                    <CardContent className="pt-4">
                      <div className="flex items-start gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{activity.activity_type}</p>
                          {activity.description && (
                            <p className="text-sm text-muted-foreground">{activity.description}</p>
                          )}
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(activity.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>

            <TabsContent value="purchases" className="space-y-2">
              {purchases.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No purchases yet
                </p>
              ) : (
                purchases.map((purchase) => (
                  <Card key={purchase.id}>
                    <CardContent className="pt-4">
                      <div className="flex items-start gap-2">
                        <ShoppingBag className="h-4 w-4 text-muted-foreground mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">
                            {purchase.products?.name || 'Product'}
                          </p>
                          <p className="text-sm text-primary font-semibold">
                            ${purchase.amount}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(purchase.purchase_date).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>

            <TabsContent value="ai" className="space-y-2">
              {aiMessages.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No AI messages yet
                </p>
              ) : (
                aiMessages.map((message) => (
                  <Card key={message.id}>
                    <CardContent className="pt-4">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Badge variant={message.channel === 'email' ? 'default' : 'secondary'}>
                            {message.channel}
                          </Badge>
                          <p className="text-xs text-muted-foreground">
                            {new Date(message.sent_at).toLocaleDateString()}
                          </p>
                        </div>
                        {message.subject && (
                          <p className="text-sm font-medium">{message.subject}</p>
                        )}
                        <p className="text-sm text-muted-foreground line-clamp-3">
                          {message.message_body}
                        </p>
                        <div className="flex gap-2 text-xs">
                          {message.opened && <Badge variant="outline">Opened</Badge>}
                          {message.replied && <Badge variant="outline">Replied</Badge>}
                          {message.converted && <Badge variant="outline">Converted</Badge>}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>
          </Tabs>

          {/* Notes */}
          {contact.notes && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{contact.notes}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
