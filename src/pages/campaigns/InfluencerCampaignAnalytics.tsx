import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Loader2, TrendingUp, Users, FileText, DollarSign, Target, Eye } from "lucide-react";

export default function InfluencerCampaignAnalytics() {
  const { id } = useParams();

  const { data: campaign, isLoading: campaignLoading } = useQuery({
    queryKey: ["campaign", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_sales_campaigns")
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: influencerCampaign, isLoading: influencerLoading } = useQuery({
    queryKey: ["influencer-campaign", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("influencer_campaigns")
        .select("*")
        .eq("sales_campaign_id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: contacts, isLoading: contactsLoading } = useQuery({
    queryKey: ["campaign-contacts", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_sales_campaign_contacts")
        .select(`
          *,
          contacts:contact_id (
            full_name,
            platform,
            platform_handle,
            follower_count,
            engagement_rate
          )
        `)
        .eq("campaign_id", id);
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  if (campaignLoading || influencerLoading || contactsLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!campaign) {
    return <div className="p-6">Campaign not found</div>;
  }

  const totalReach = contacts?.reduce((sum, c: any) => sum + (c.contacts?.follower_count || 0), 0) || 0;
  const deliveredCount = influencerCampaign?.content_pieces_delivered || 0;
  const expectedDeliverables = influencerCampaign?.expected_deliverables
    ? Object.values(influencerCampaign.expected_deliverables as Record<string, any>).reduce((sum: number, platform: any) => {
        if (typeof platform === 'object' && platform !== null) {
          const platformTotal = Object.values(platform).reduce<number>((pSum, val) => pSum + (Number(val) || 0), 0);
          return sum + platformTotal;
        }
        return sum;
      }, 0)
    : 0;

  const responseRate = contacts && contacts.length > 0
    ? ((contacts.filter((c: any) => c.responded).length / contacts.length) * 100).toFixed(1)
    : "0.0";

  const conversionRate = contacts && contacts.length > 0
    ? ((contacts.filter((c: any) => c.converted).length / contacts.length) * 100).toFixed(1)
    : "0.0";

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{campaign.name}</h1>
        <p className="text-muted-foreground">Influencer Campaign Analytics</p>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Reach</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalReach.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Across {contacts?.length || 0} creators
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Response Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{responseRate}%</div>
            <p className="text-xs text-muted-foreground">
              {contacts?.filter((c: any) => c.responded).length || 0} responded
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Content Delivered</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{deliveredCount}/{expectedDeliverables}</div>
            <Progress 
              value={expectedDeliverables > 0 ? (deliveredCount / expectedDeliverables) * 100 : 0} 
              className="mt-2"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{conversionRate}%</div>
            <p className="text-xs text-muted-foreground">
              {contacts?.filter((c: any) => c.converted).length || 0} contracts signed
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Campaign Details */}
      {influencerCampaign && (
        <Card>
          <CardHeader>
            <CardTitle>Campaign Details</CardTitle>
            <CardDescription>Collaboration specifics and goals</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-medium mb-2">Campaign Type</h4>
                <Badge variant="outline">{influencerCampaign.campaign_type?.replace(/_/g, ' ')}</Badge>
              </div>
              <div>
                <h4 className="font-medium mb-2">Target Platforms</h4>
                <div className="flex flex-wrap gap-2">
                  {influencerCampaign.target_platforms?.map((platform: string) => (
                    <Badge key={platform} variant="secondary">{platform}</Badge>
                  ))}
                </div>
              </div>
            </div>

            {influencerCampaign.budget_total && (
              <div>
                <h4 className="font-medium mb-2">Budget</h4>
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  <span className="text-lg font-semibold">
                    ${Number(influencerCampaign.budget_total).toLocaleString()}
                  </span>
                  {influencerCampaign.budget_remaining && (
                    <Badge variant="outline">
                      ${Number(influencerCampaign.budget_remaining).toLocaleString()} remaining
                    </Badge>
                  )}
                </div>
              </div>
            )}

            {influencerCampaign.content_guidelines && (
              <div>
                <h4 className="font-medium mb-2">Content Guidelines</h4>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {influencerCampaign.content_guidelines}
                </p>
              </div>
            )}

            {influencerCampaign.hashtags && influencerCampaign.hashtags.length > 0 && (
              <div>
                <h4 className="font-medium mb-2">Required Hashtags</h4>
                <div className="flex flex-wrap gap-2">
                  {influencerCampaign.hashtags.map((tag: string) => (
                    <Badge key={tag} variant="outline">#{tag}</Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Top Performers */}
      <Card>
        <CardHeader>
          <CardTitle>Participating Creators</CardTitle>
          <CardDescription>Influencers in this campaign</CardDescription>
        </CardHeader>
        <CardContent>
          {contacts && contacts.length > 0 ? (
            <div className="space-y-3">
              {contacts.map((contact: any) => (
                <div key={contact.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Users className="h-8 w-8 text-muted-foreground" />
                    <div>
                      <div className="font-medium">{contact.contacts?.full_name}</div>
                      <div className="text-sm text-muted-foreground">
                        {contact.contacts?.platform_handle && `@${contact.contacts.platform_handle}`}
                        {contact.contacts?.platform && ` • ${contact.contacts.platform}`}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">
                      {contact.contacts?.follower_count?.toLocaleString() || "N/A"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {contact.contacts?.engagement_rate ? `${contact.contacts.engagement_rate}% eng` : "followers"}
                    </div>
                  </div>
                  <div>
                    {contact.converted && <Badge>Converted</Badge>}
                    {contact.responded && !contact.converted && <Badge variant="secondary">Responded</Badge>}
                    {!contact.responded && <Badge variant="outline">Pending</Badge>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">
              No creators have been contacted yet
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
