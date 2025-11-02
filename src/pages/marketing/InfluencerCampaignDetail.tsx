import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Pause, Play, StopCircle, Edit } from "lucide-react";
import { PlatformBadge } from "@/components/marketing/PlatformBadge";
import { Skeleton } from "@/components/ui/skeleton";

export default function InfluencerCampaignDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data: campaign, isLoading } = useQuery({
    queryKey: ["influencer-campaign", id],
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
        .eq("id", id)
        .single();
      if (error) throw error;
      return data as any;
    },
  });

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="container mx-auto p-6">
        <p>Campaign not found</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/marketing")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{campaign.ai_sales_campaigns?.name || "Untitled Campaign"}</h1>
            <p className="text-muted-foreground">{campaign.campaign_type}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
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
          {campaign.ai_sales_campaigns?.status === "draft" && (
            <Button variant="outline">
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
          )}
          {campaign.ai_sales_campaigns?.status === "active" && (
            <Button variant="outline">
              <Pause className="h-4 w-4 mr-2" />
              Pause
            </Button>
          )}
          {campaign.ai_sales_campaigns?.status === "paused" && (
            <Button variant="outline">
              <Play className="h-4 w-4 mr-2" />
              Resume
            </Button>
          )}
          {campaign.ai_sales_campaigns?.status !== "completed" && (
            <Button variant="destructive">
              <StopCircle className="h-4 w-4 mr-2" />
              Stop
            </Button>
          )}
        </div>
      </div>

      {/* Platform Badges */}
      <div className="flex gap-2">
        {campaign.target_platforms?.map((platform: string) => (
          <PlatformBadge key={platform} platform={platform} />
        ))}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="dashboard" className="space-y-6">
        <TabsList>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="influencers">Influencers</TabsTrigger>
          <TabsTrigger value="content">Content</TabsTrigger>
          <TabsTrigger value="messages">Messages</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-6">
          {/* Key Metrics */}
          <div className="grid md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Reach</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {((campaign.total_reach || 0) / 1000).toFixed(1)}K
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Engagement</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {((campaign.total_engagement || 0) / 1000).toFixed(1)}K
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Content Delivered</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {campaign.content_pieces_delivered || 0}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Contracts Signed</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {campaign.contracts_signed || 0}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Performance Over Time</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-muted-foreground">
                Chart coming soon
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="influencers">
          <Card>
            <CardHeader>
              <CardTitle>Campaign Influencers</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-muted-foreground">
                Influencer list coming soon
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="content">
          <Card>
            <CardHeader>
              <CardTitle>Delivered Content</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-muted-foreground">
                Content gallery coming soon
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="messages">
          <Card>
            <CardHeader>
              <CardTitle>Message Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-muted-foreground">
                Messages coming soon
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics">
          <Card>
            <CardHeader>
              <CardTitle>Detailed Analytics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-muted-foreground">
                Analytics coming soon
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
