import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Play, Pause, CheckCircle, Clock, Send } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

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

      // Send messages in background
      let successCount = 0;
      let failureCount = 0;

      for (const contact of contacts) {
        if (!contact.phone_number) {
          failureCount++;
          continue;
        }

        try {
          const { error: sendError } = await supabase.functions.invoke("send-sms", {
            body: {
              to: contact.phone_number,
              message: campaign.message_template.replace("{FirstName}", contact.full_name.split(" ")[0])
            }
          });

          if (sendError) {
            console.error(`Failed to send to ${contact.phone_number}:`, sendError);
            failureCount++;
          } else {
            successCount++;
          }

          // Update progress
          await supabase
            .from("campaigns")
            .update({ 
              sent_count: successCount,
              failed_count: failureCount
            })
            .eq("id", campaign.id);

        } catch (error) {
          console.error(`Error sending to ${contact.phone_number}:`, error);
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

      toast.success(`Campaign sent! ${successCount} successful, ${failureCount} failed`);
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
        <div className="space-y-4">
          {campaigns.map((campaign) => (
            <Card 
              key={campaign.id} 
              className="border-border/50 hover:border-primary/50 transition-colors cursor-pointer"
              onClick={() => navigate(`/campaigns/${campaign.id}`)}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2">
                      {getStatusIcon(campaign.status)}
                      {campaign.name}
                    </CardTitle>
                    <CardDescription>
                      Created {format(new Date(campaign.created_at), "MMM d, yyyy 'at' h:mm a")}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    {campaign.status === "draft" && (
                      <Button
                        size="sm"
                        onClick={(e) => handleSendCampaign(campaign, e)}
                        disabled={sendingCampaignId === campaign.id}
                        className="gap-1"
                      >
                        <Send className="h-3 w-3" />
                        {sendingCampaignId === campaign.id ? "Sending..." : "Send Now"}
                      </Button>
                    )}
                    <Badge variant={getStatusBadgeVariant(campaign.status)}>
                      {campaign.status}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Total Contacts</p>
                    <p className="font-semibold">{campaign.total_contacts}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Sent</p>
                    <p className="font-semibold text-warning">{campaign.sent_count}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Delivered</p>
                    <p className="font-semibold text-primary">{campaign.delivered_count}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Replies</p>
                    <p className="font-semibold text-secondary">{campaign.reply_count}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default Campaigns;
