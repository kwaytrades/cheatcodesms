import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, Users, DollarSign, FileText } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";

export function InfluencerAnalytics() {
  const { data: campaigns, isLoading } = useQuery({
    queryKey: ["influencer-analytics"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("influencer_campaigns")
        .select(`
          *,
          ai_sales_campaigns!inner(*)
        `);

      if (error) throw error;
      return data || [];
    }
  });

  const stats = {
    totalCampaigns: campaigns?.length || 0,
    activeCampaigns: campaigns?.filter(c => c.ai_sales_campaigns?.status === "active").length || 0,
    totalReach: campaigns?.reduce((sum, c) => sum + (c.total_reach || 0), 0) || 0,
    avgEngagement: campaigns?.length 
      ? (campaigns.reduce((sum, c) => sum + (c.total_engagement || 0), 0) / campaigns.reduce((sum, c) => sum + (c.total_reach || 1), 1) * 100).toFixed(1)
      : "0.0",
    totalContent: campaigns?.reduce((sum, c) => sum + (c.content_pieces_delivered || 0), 0) || 0,
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!campaigns || campaigns.length === 0) {
    return (
      <div className="text-center py-12">
        <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium mb-2">No campaigns yet</h3>
        <p className="text-muted-foreground">
          Create your first influencer campaign to see analytics
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Campaigns</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalCampaigns}</div>
            <p className="text-xs text-muted-foreground">
              {stats.activeCampaigns} active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Reach</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.totalReach >= 1000000 
                ? `${(stats.totalReach / 1000000).toFixed(1)}M` 
                : stats.totalReach >= 1000 
                ? `${(stats.totalReach / 1000).toFixed(1)}K`
                : stats.totalReach}
            </div>
            <p className="text-xs text-muted-foreground">Combined followers</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Avg Engagement</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.avgEngagement}%</div>
            <p className="text-xs text-muted-foreground">Across all campaigns</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Content Delivered</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalContent}</div>
            <p className="text-xs text-muted-foreground">Total pieces</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Campaign Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {campaigns.map((campaign) => (
              <div key={campaign.id} className="flex items-center justify-between p-3 border rounded">
                <div>
                  <p className="font-medium">{campaign.ai_sales_campaigns?.name}</p>
                  <p className="text-sm text-muted-foreground">
                    Reach: {campaign.total_reach?.toLocaleString() || 0} • 
                    Content: {campaign.content_pieces_delivered || 0} • 
                    Engagement: {((campaign.total_engagement || 0) / (campaign.total_reach || 1) * 100).toFixed(1)}%
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium capitalize">{campaign.ai_sales_campaigns?.status || "draft"}</p>
                  <p className="text-xs text-muted-foreground">
                    {campaign.influencers_contacted || 0} contacted
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
