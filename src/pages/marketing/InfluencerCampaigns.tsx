import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Users, TrendingUp, Target, DollarSign } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { PlatformBadge } from "@/components/marketing/PlatformBadge";

export function InfluencerCampaigns() {
  const navigate = useNavigate();

  const { data: campaigns } = useQuery({
    queryKey: ["influencer-campaigns"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("influencer_campaigns")
        .select(`
          *,
          ai_sales_campaigns (
            name,
            status
          )
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const stats = {
    total: campaigns?.length || 0,
    active: campaigns?.filter((c) => c.ai_sales_campaigns?.status === "active").length || 0,
    totalReach: campaigns?.reduce((acc, c) => acc + (c.total_reach || 0), 0) || 0,
    avgEngagement: campaigns?.length && campaigns.reduce((acc, c) => acc + (c.total_engagement || 0), 0) > 0
      ? ((campaigns.reduce((acc, c) => acc + (c.total_engagement || 0), 0) / campaigns.length) / 1000).toFixed(1)
      : "0",
  };

  return (
    <div className="space-y-6">
      {/* Stats Dashboard */}
      <div className="grid md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Campaigns</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.active}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Reach</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(stats.totalReach / 1000).toFixed(1)}K
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Avg Engagement</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.avgEngagement}K</div>
          </CardContent>
        </Card>
      </div>

      {/* Create Campaign Button */}
      <Button onClick={() => navigate("/marketing/campaigns/new")} size="lg">
        <Plus className="h-4 w-4 mr-2" />
        Create Campaign
      </Button>

      {/* Campaign Cards Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {campaigns?.map((campaign) => (
          <Card
            key={campaign.id}
            className="cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => navigate(`/marketing/campaigns/${campaign.id}`)}
          >
            <CardHeader>
              <div className="flex items-start justify-between">
                <CardTitle className="text-lg">{campaign.ai_sales_campaigns?.name || "Untitled Campaign"}</CardTitle>
                <Badge
                  variant={
                    campaign.ai_sales_campaigns?.status === "active"
                      ? "default"
                      : campaign.ai_sales_campaigns?.status === "draft"
                      ? "secondary"
                      : "outline"
                  }
                >
                  {campaign.ai_sales_campaigns?.status || "draft"}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">{campaign.campaign_type}</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                {campaign.target_platforms?.map((platform: string) => (
                  <PlatformBadge key={platform} platform={platform} />
                ))}
              </div>

              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-muted-foreground">Progress</span>
                  <span className="font-medium">
                    {campaign.influencers_contacted || 0}/{campaign.influencers_interested || 0}
                  </span>
                </div>
                <Progress
                  value={
                    ((campaign.influencers_contacted || 0) /
                      Math.max(campaign.influencers_interested || 1, 1)) *
                    100
                  }
                />
              </div>

              <div className="grid grid-cols-3 gap-2 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs">Reach</p>
                  <p className="font-medium">{(campaign.total_reach || 0) / 1000}K</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Content</p>
                  <p className="font-medium">{campaign.content_pieces_delivered || 0}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Engagement</p>
                  <p className="font-medium">{((campaign.total_engagement || 0) / 1000).toFixed(1)}K</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {campaigns?.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No campaigns yet</p>
        </div>
      )}
    </div>
  );
}
