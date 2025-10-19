import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Send, CheckCircle, XCircle, MessageSquare, Clock, Users } from "lucide-react";
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
  opt_out_count: number;
  scheduled_time: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

const CampaignDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (id) {
      loadCampaign();
    }
  }, [id]);

  const loadCampaign = async () => {
    try {
      const { data, error } = await supabase
        .from("campaigns")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (error) throw error;
      
      if (!data) {
        toast.error("Campaign not found");
        navigate("/campaigns");
        return;
      }

      setCampaign(data as Campaign);
    } catch (error) {
      console.error("Error loading campaign:", error);
      toast.error("Failed to load campaign");
    } finally {
      setLoading(false);
    }
  };

  const handleSendCampaign = async () => {
    if (!campaign || !campaign.audience_filter?.contact_ids || campaign.audience_filter.contact_ids.length === 0) {
      toast.error("No contacts selected for this campaign");
      return;
    }

    setSending(true);

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
      loadCampaign();

    } catch (error: any) {
      console.error("Error sending campaign:", error);
      toast.error(error.message || "Failed to send campaign");
      
      // Revert status on error
      await supabase
        .from("campaigns")
        .update({ status: "draft" })
        .eq("id", campaign.id);
    } finally {
      setSending(false);
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

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/4"></div>
          <div className="h-64 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="p-8">
        <Card>
          <CardHeader>
            <CardTitle>Campaign Not Found</CardTitle>
            <CardDescription>The campaign you're looking for doesn't exist.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate("/campaigns")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Campaigns
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate("/campaigns")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{campaign.name}</h1>
            <p className="text-muted-foreground">
              Created {format(new Date(campaign.created_at), "MMM d, yyyy 'at' h:mm a")}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant={getStatusBadgeVariant(campaign.status)} className="text-sm px-3 py-1">
            {campaign.status}
          </Badge>
          {campaign.status === "draft" && (
            <Button onClick={handleSendCampaign} disabled={sending} className="gap-2">
              <Send className="h-4 w-4" />
              {sending ? "Sending..." : "Send Now"}
            </Button>
          )}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Contacts</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{campaign.total_contacts}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sent</CardTitle>
            <Send className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{campaign.sent_count}</div>
            <p className="text-xs text-muted-foreground">
              {campaign.total_contacts > 0 
                ? `${((campaign.sent_count / campaign.total_contacts) * 100).toFixed(1)}%`
                : "0%"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Delivered</CardTitle>
            <CheckCircle className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{campaign.delivered_count}</div>
            <p className="text-xs text-muted-foreground">
              {campaign.sent_count > 0 
                ? `${((campaign.delivered_count / campaign.sent_count) * 100).toFixed(1)}%`
                : "0%"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Replies</CardTitle>
            <MessageSquare className="h-4 w-4 text-secondary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-secondary">{campaign.reply_count}</div>
            <p className="text-xs text-muted-foreground">
              {campaign.delivered_count > 0 
                ? `${((campaign.reply_count / campaign.delivered_count) * 100).toFixed(1)}%`
                : "0%"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Campaign Details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Message Template</CardTitle>
            <CardDescription>The message sent to contacts</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="p-4 bg-muted rounded-lg">
              <p className="whitespace-pre-wrap">{campaign.message_template}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Campaign Details</CardTitle>
            <CardDescription>Additional information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status</span>
              <Badge variant={getStatusBadgeVariant(campaign.status)}>{campaign.status}</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Failed Messages</span>
              <span className="font-medium text-destructive">{campaign.failed_count}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Opt-outs</span>
              <span className="font-medium">{campaign.opt_out_count}</span>
            </div>
            {campaign.scheduled_time && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Scheduled For</span>
                <span className="font-medium flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {format(new Date(campaign.scheduled_time), "MMM d, h:mm a")}
                </span>
              </div>
            )}
            {campaign.completed_at && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Completed At</span>
                <span className="font-medium">
                  {format(new Date(campaign.completed_at), "MMM d, h:mm a")}
                </span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Last Updated</span>
              <span className="font-medium">
                {format(new Date(campaign.updated_at), "MMM d, h:mm a")}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CampaignDetail;
