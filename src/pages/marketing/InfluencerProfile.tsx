import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ArrowLeft, UserPlus, ExternalLink } from "lucide-react";
import { PlatformBadge } from "@/components/marketing/PlatformBadge";
import { Skeleton } from "@/components/ui/skeleton";

export default function InfluencerProfile() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data: influencer, isLoading } = useQuery({
    queryKey: ["influencer", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
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

  if (!influencer) {
    return (
      <div className="container mx-auto p-6">
        <p>Influencer not found</p>
      </div>
    );
  }

  const formatFollowers = (count?: number) => {
    if (!count) return "0";
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toString();
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-3xl font-bold">Influencer Profile</h1>
      </div>

      {/* Profile Header */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              <Avatar className="h-20 w-20">
                <AvatarFallback className="text-2xl">
                  {influencer.full_name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .toUpperCase()
                    .slice(0, 2)}
                </AvatarFallback>
              </Avatar>
              <div>
                <h2 className="text-2xl font-bold">{influencer.full_name}</h2>
                {influencer.platform_handle && (
                  <p className="text-muted-foreground">
                    @{influencer.platform_handle}
                  </p>
                )}
                <div className="flex gap-2 mt-2">
                  {influencer.platform && (
                    <PlatformBadge platform={influencer.platform} />
                  )}
                  {influencer.influencer_tier && (
                    <Badge variant="secondary">{influencer.influencer_tier}</Badge>
                  )}
                </div>
              </div>
            </div>
            <Button>
              <UserPlus className="h-4 w-4 mr-2" />
              Add to Campaign
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Metrics Cards */}
      <div className="grid md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Followers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatFollowers(influencer.follower_count)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Engagement Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {influencer.engagement_rate?.toFixed(1) || "0"}%
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Avg Views</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatFollowers(influencer.avg_views)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Platform</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              {influencer.platform && (
                <PlatformBadge platform={influencer.platform} size="lg" />
              )}
              {influencer.platform_handle && (
                <a
                  href={`https://${influencer.platform}.com/@${influencer.platform_handle}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Niche & Content */}
      {influencer.niche_categories && influencer.niche_categories.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Niche Categories</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {influencer.niche_categories.map((niche) => (
                <Badge key={niche} variant="secondary">
                  {niche}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Collaboration History */}
      {influencer.collaboration_history &&
        Array.isArray(influencer.collaboration_history) &&
        influencer.collaboration_history.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Past Collaborations</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {influencer.collaboration_history.map((collab: any, i: number) => (
                  <div key={i} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">{collab.brand}</p>
                      <p className="text-sm text-muted-foreground">{collab.type}</p>
                    </div>
                    <Badge variant="outline">{collab.year}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
    </div>
  );
}
