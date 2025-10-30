import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Play, Pause, CheckCircle, Clock, Send, MessageSquare, Mail, Bot, Users } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { FailedMessagesDialog } from "@/components/FailedMessagesDialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Campaign {
  id: string;
  name: string;
  status: string;
  channel: string;
  message_template: string;
  subject?: string;
  from_email?: string;
  from_name?: string;
  reply_to?: string;
  html_template?: string;
  plain_text_template?: string;
  audience_filter: { contact_ids?: string[] } | null;
  total_contacts: number;
  sent_count: number;
  delivered_count: number;
  failed_count: number;
  reply_count: number;
  created_at: string;
}

const Campaigns = () => {
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [salesCampaigns, setSalesCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingCampaignId, setSendingCampaignId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("sms");

  useEffect(() => {
    loadCampaigns();
    loadSalesCampaigns();
    
    // Subscribe to campaign changes
    const channel = supabase
      .channel('campaigns-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'campaigns'
        },
        () => {
          loadCampaigns();
        }
      )
      .subscribe();

    const salesChannel = supabase
      .channel('sales-campaigns-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ai_sales_campaigns'
        },
        () => {
          loadSalesCampaigns();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(salesChannel);
    };
  }, []);

  const loadCampaigns = async () => {
    try {
      const { data, error } = await supabase
        .from("campaigns")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setCampaigns((data || []) as Campaign[]);
    } catch (error) {
      console.error("Error loading campaigns:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadSalesCampaigns = async () => {
    try {
      const { data, error } = await supabase
        .from("ai_sales_campaigns")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setSalesCampaigns(data || []);
    } catch (error) {
      console.error("Error loading sales campaigns:", error);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="h-4 w-4 text-primary" />;
      case "running":
        return <Play className="h-4 w-4 text-warning animate-pulse" />;
      case "scheduled":
        return <Clock className="h-4 w-4 text-secondary" />;
      case "paused":
        return <Pause className="h-4 w-4 text-muted-foreground" />;
      default:
        return <Send className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "completed":
        return "default";
      case "running":
        return "default";
      case "scheduled":
        return "secondary";
      default:
        return "outline";
    }
  };

  const handleSendCampaign = async (campaign: Campaign, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!campaign.audience_filter?.contact_ids || campaign.audience_filter.contact_ids.length === 0) {
      toast.error("No contacts selected for this campaign");
      return;
    }

    setSendingCampaignId(campaign.id);

    try {
      // Update campaign status to running
      const { error: updateError } = await supabase
        .from("campaigns")
        .update({ status: "running" })
        .eq("id", campaign.id);

      if (updateError) throw updateError;

      // Get contacts with appropriate fields based on channel
      const selectFields = campaign.channel === "sms" 
        ? "id, full_name, phone_number"
        : "id, full_name, email";

      const { data: contacts, error: contactsError } = await supabase
        .from("contacts")
        .select(selectFields)
        .in("id", campaign.audience_filter.contact_ids);

      if (contactsError) throw contactsError;

      toast.success(`Sending campaign to ${contacts.length} contacts...`);

      // Send messages and track results
      let successCount = 0;
      let failureCount = 0;

      for (const contact of contacts) {
        const firstName = contact.full_name.split(" ")[0];

        if (campaign.channel === "sms") {
          const personalizedMessage = campaign.message_template.replace("{FirstName}", firstName);

          if (!("phone_number" in contact) || !contact.phone_number) {
            await supabase.from("campaign_messages").insert({
              campaign_id: campaign.id,
              phone_number: "N/A",
              personalized_message: personalizedMessage,
              status: "failed",
              error_message: "Contact has no phone number"
            });
            failureCount++;
            continue;
          }

          try {
            const { data: sendData, error: sendError } = await supabase.functions.invoke("send-sms", {
              body: {
                to: contact.phone_number,
                message: personalizedMessage
              }
            });

            if (sendError || !sendData?.success) {
              await supabase.from("campaign_messages").insert({
                campaign_id: campaign.id,
                phone_number: contact.phone_number,
                personalized_message: personalizedMessage,
                status: "failed",
                error_message: sendError?.message || sendData?.error || "Unknown error",
                sent_at: new Date().toISOString()
              });
              failureCount++;
            } else {
              await supabase.from("campaign_messages").insert({
                campaign_id: campaign.id,
                phone_number: contact.phone_number,
                personalized_message: personalizedMessage,
                status: "sent",
                twilio_message_sid: sendData.messageSid,
                sent_at: new Date().toISOString()
              });
              successCount++;
            }
          } catch (error: any) {
            console.error(`Error sending SMS to ${contact.phone_number}:`, error);
            await supabase.from("campaign_messages").insert({
              campaign_id: campaign.id,
              phone_number: contact.phone_number,
              personalized_message: personalizedMessage,
              status: "failed",
              error_message: error.message || "Exception occurred during send",
              sent_at: new Date().toISOString()
            });
            failureCount++;
          }
        } else {
          // Email campaign
          if (!("email" in contact) || !contact.email) {
            await supabase.from("campaign_messages").insert({
              campaign_id: campaign.id,
              to_email: "N/A",
              personalized_message: "",
              phone_number: "",
              status: "failed",
              error_message: "Contact has no email"
            });
            failureCount++;
            continue;
          }

          const personalizedSubject = campaign.subject?.replace("{FirstName}", firstName) || "";
          const personalizedHtml = campaign.html_template?.replace("{FirstName}", firstName) || "";
          const personalizedText = campaign.plain_text_template?.replace("{FirstName}", firstName) || "";

          try {
            const { data: sendData, error: sendError } = await supabase.functions.invoke("send-email", {
              body: {
                to: contact.email,
                subject: personalizedSubject,
                htmlBody: personalizedHtml,
                textBody: personalizedText,
                fromEmail: campaign.from_email,
                fromName: campaign.from_name,
                replyTo: campaign.reply_to
              }
            });

            if (sendError || !sendData?.success) {
              await supabase.from("campaign_messages").insert({
                campaign_id: campaign.id,
                to_email: contact.email,
                subject: personalizedSubject,
                html_body: personalizedHtml,
                plain_text_body: personalizedText,
                personalized_message: personalizedText,
                phone_number: "",
                status: "failed",
                error_message: sendError?.message || sendData?.error || "Unknown error",
                sent_at: new Date().toISOString()
              });
              failureCount++;
            } else {
              await supabase.from("campaign_messages").insert({
                campaign_id: campaign.id,
                to_email: contact.email,
                subject: personalizedSubject,
                html_body: personalizedHtml,
                plain_text_body: personalizedText,
                personalized_message: personalizedText,
                phone_number: "",
                status: "sent",
                sent_at: new Date().toISOString()
              });
              successCount++;
            }
          } catch (error: any) {
            console.error(`Error sending email to ${contact.email}:`, error);
            await supabase.from("campaign_messages").insert({
              campaign_id: campaign.id,
              to_email: contact.email,
              subject: personalizedSubject,
              html_body: personalizedHtml,
              plain_text_body: personalizedText,
              personalized_message: personalizedText,
              phone_number: "",
              status: "failed",
              error_message: error.message || "Exception occurred during send",
              sent_at: new Date().toISOString()
            });
            failureCount++;
          }
        }

        // Update campaign progress
        await supabase
          .from("campaigns")
          .update({ 
            sent_count: successCount,
            failed_count: failureCount
          })
          .eq("id", campaign.id);
      }

      // Mark campaign as completed
      await supabase
        .from("campaigns")
        .update({ 
          status: "completed",
          completed_at: new Date().toISOString()
        })
        .eq("id", campaign.id);

      if (failureCount > 0) {
        toast.warning(`Campaign completed: ${successCount} sent, ${failureCount} failed`);
      } else {
        toast.success(`Campaign sent successfully to ${successCount} contacts!`);
      }
      
      loadCampaigns();

    } catch (error: any) {
      console.error("Error sending campaign:", error);
      toast.error(error.message || "Failed to send campaign");
      
      // Revert status on error
      await supabase
        .from("campaigns")
        .update({ status: "draft" })
        .eq("id", campaign.id);
    } finally {
      setSendingCampaignId(null);
    }
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/4"></div>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-muted rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const smsCampaigns = campaigns.filter(c => c.channel === 'sms');
  const emailCampaigns = campaigns.filter(c => c.channel === 'email');

  const getAgentIcon = (agentType: string) => {
    return <Bot className="h-4 w-4" />;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-primary/20 text-primary border-primary/30';
      case 'completed':
        return 'bg-green-500/20 text-green-700 dark:text-green-300 border-green-500/30';
      case 'paused':
        return 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-300 border-yellow-500/30';
      default:
        return 'bg-muted text-muted-foreground border-border';
    }
  };

  const renderSalesCampaignList = (campaignList: any[]) => {
    if (campaignList.length === 0) {
      return (
        <Card className="border-dashed">
          <CardHeader className="text-center">
            <CardTitle>No AI sales campaigns yet</CardTitle>
            <CardDescription>Create your first AI-powered sales campaign to get started</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Button onClick={() => navigate("/sales-campaigns/new")}>
              <Plus className="h-4 w-4 mr-2" />
              Create Sales Campaign
            </Button>
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="border rounded-lg overflow-hidden bg-card">
        {campaignList.map((campaign, index) => (
          <div 
            key={campaign.id} 
            className={`flex items-center gap-4 px-6 py-4 hover:bg-muted/50 transition-colors cursor-pointer ${
              index !== campaignList.length - 1 ? 'border-b' : ''
            }`}
            onClick={() => navigate(`/sales-campaigns/${campaign.id}`)}
          >
            <div className="flex items-center gap-3 min-w-0 flex-1">
              {getAgentIcon(campaign.agent_type)}
              <div className="min-w-0 flex-1">
                <div className="font-semibold truncate">{campaign.name}</div>
                <div className="text-sm text-muted-foreground">
                  {format(new Date(campaign.created_at), "MMM d, yyyy 'at' h:mm a")}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-6 text-sm">
              <div className="text-center">
                <div className="text-muted-foreground text-xs">Contacts</div>
                <div className="font-semibold">{campaign.total_contacts || 0}</div>
              </div>
              <div className="text-center">
                <div className="text-muted-foreground text-xs">Engaged</div>
                <div className="font-semibold text-primary">{campaign.engaged_count || 0}</div>
              </div>
              <div className="text-center">
                <div className="text-muted-foreground text-xs">Converted</div>
                <div className="font-semibold text-green-600">{campaign.conversion_count || 0}</div>
              </div>
              <div className="text-center">
                <div className="text-muted-foreground text-xs">Rate</div>
                <div className="font-semibold">
                  {campaign.engaged_count > 0 
                    ? `${Math.round(((campaign.conversion_count || 0) / campaign.engaged_count) * 100)}%`
                    : '0%'
                  }
                </div>
              </div>
            </div>

            <Badge variant="outline" className={getStatusColor(campaign.status)}>
              {campaign.status}
            </Badge>
          </div>
        ))}
      </div>
    );
  };

  const renderCampaignList = (campaignList: Campaign[]) => {
    if (campaignList.length === 0) {
      return (
        <Card className="border-dashed">
          <CardHeader className="text-center">
            <CardTitle>No campaigns yet</CardTitle>
            <CardDescription>Create your first campaign to get started</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Button onClick={() => navigate("/campaigns/new")}>
              <Plus className="h-4 w-4 mr-2" />
              Create Campaign
            </Button>
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="border rounded-lg overflow-hidden bg-card">
        {campaignList.map((campaign, index) => (
          <div 
            key={campaign.id} 
            className={`flex items-center gap-4 px-6 py-4 hover:bg-muted/50 transition-colors cursor-pointer ${
              index !== campaignList.length - 1 ? 'border-b' : ''
            }`}
            onClick={() => navigate(`/campaigns/${campaign.id}`)}
          >
            <div className="flex items-center gap-3 min-w-0 flex-1">
              {getStatusIcon(campaign.status)}
              <div className="min-w-0 flex-1">
                <div className="font-semibold truncate">{campaign.name}</div>
                <div className="text-sm text-muted-foreground">
                  {format(new Date(campaign.created_at), "MMM d, yyyy 'at' h:mm a")}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-6 text-sm">
              <div className="text-center">
                <div className="text-muted-foreground text-xs">Contacts</div>
                <div className="font-semibold">{campaign.total_contacts}</div>
              </div>
              <div className="text-center">
                <div className="text-muted-foreground text-xs">Sent</div>
                <div className="font-semibold text-warning">{campaign.sent_count}</div>
              </div>
              <div className="text-center">
                <div className="text-muted-foreground text-xs">Delivered</div>
                <div className="font-semibold text-primary">{campaign.delivered_count}</div>
              </div>
              <div className="text-center">
                <div className="text-muted-foreground text-xs">Replies</div>
                <div className="font-semibold text-secondary">{campaign.reply_count}</div>
              </div>
              {campaign.failed_count > 0 && (
                <div className="text-center">
                  <div className="text-muted-foreground text-xs">Failed</div>
                  <div className="font-semibold">
                    <FailedMessagesDialog campaignId={campaign.id} failedCount={campaign.failed_count} />
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 ml-4">
              <Badge variant={getStatusBadgeVariant(campaign.status)}>
                {campaign.status}
              </Badge>
              {campaign.status === "draft" && (
                <Button
                  size="sm"
                  onClick={(e) => handleSendCampaign(campaign, e)}
                  disabled={sendingCampaignId === campaign.id}
                  className="gap-1"
                >
                  <Send className="h-3 w-3" />
                  {sendingCampaignId === campaign.id ? "Sending..." : "Send"}
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Campaigns</h1>
          <p className="text-muted-foreground">Create and manage your messaging campaigns</p>
        </div>
        <Button 
          onClick={() => {
            if (activeTab === "sales") {
              navigate("/sales-campaigns/new");
            } else {
              navigate("/campaigns/new");
            }
          }} 
          className="gap-2"
        >
          <Plus className="h-4 w-4" />
          New {activeTab === "sales" ? "AI Sales " : ""}Campaign
        </Button>
      </div>

      <Tabs defaultValue="sms" className="w-full" onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="sms" className="gap-2">
            <MessageSquare className="h-4 w-4" />
            SMS Campaigns ({smsCampaigns.length})
          </TabsTrigger>
          <TabsTrigger value="email" className="gap-2">
            <Mail className="h-4 w-4" />
            Email Campaigns ({emailCampaigns.length})
          </TabsTrigger>
          <TabsTrigger value="sales" className="gap-2">
            <Bot className="h-4 w-4" />
            AI Sales Campaigns ({salesCampaigns.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sms" className="mt-6">
          {renderCampaignList(smsCampaigns)}
        </TabsContent>

        <TabsContent value="email" className="mt-6">
          {renderCampaignList(emailCampaigns)}
        </TabsContent>

        <TabsContent value="sales" className="mt-6">
          {renderSalesCampaignList(salesCampaigns)}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Campaigns;
