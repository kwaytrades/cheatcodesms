import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Play, Pause, CheckCircle, Clock, Send } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { FailedMessagesDialog } from "@/components/FailedMessagesDialog";

interface Campaign {
  id: string;
  name: string;
  status: string;
  message_template: string;
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
  const [loading, setLoading] = useState(true);
  const [sendingCampaignId, setSendingCampaignId] = useState<string | null>(null);

  useEffect(() => {
    loadCampaigns();
    
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

    return () => {
      supabase.removeChannel(channel);
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

      // Get contacts
      const { data: contacts, error: contactsError } = await supabase
        .from("contacts")
        .select("id, full_name, phone_number")
        .in("id", campaign.audience_filter.contact_ids);

      if (contactsError) throw contactsError;

      toast.success(`Sending campaign to ${contacts.length} contacts...`);

      // Send messages and track results
      let successCount = 0;
      let failureCount = 0;

      for (const contact of contacts) {
        const personalizedMessage = campaign.message_template.replace(
          "{FirstName}", 
          contact.full_name.split(" ")[0]
        );

        if (!contact.phone_number) {
          // Record failed message - no phone number
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
            // Record failed message with error
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
            // Record successful message
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

          // Update campaign progress
          await supabase
            .from("campaigns")
            .update({ 
              sent_count: successCount,
              failed_count: failureCount
            })
            .eq("id", campaign.id);

        } catch (error: any) {
          console.error(`Error sending to ${contact.phone_number}:`, error);
          
          // Record failed message with exception
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

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Campaigns</h1>
          <p className="text-muted-foreground">Create and manage your SMS campaigns</p>
        </div>
        <Button onClick={() => navigate("/campaigns/new")} className="gap-2">
          <Plus className="h-4 w-4" />
          New Campaign
        </Button>
      </div>

      {campaigns.length === 0 ? (
        <Card className="border-dashed">
          <CardHeader className="text-center">
            <CardTitle>No campaigns yet</CardTitle>
            <CardDescription>Create your first SMS campaign to get started</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Button onClick={() => navigate("/campaigns/new")}>
              <Plus className="h-4 w-4 mr-2" />
              Create Campaign
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="border rounded-lg overflow-hidden bg-card">
          {campaigns.map((campaign, index) => (
            <div 
              key={campaign.id} 
              className={`flex items-center gap-4 px-6 py-4 hover:bg-muted/50 transition-colors cursor-pointer ${
                index !== campaigns.length - 1 ? 'border-b' : ''
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
      )}
    </div>
  );
};

export default Campaigns;
