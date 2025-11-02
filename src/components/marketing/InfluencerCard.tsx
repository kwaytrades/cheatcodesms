import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Eye, UserPlus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { PlatformBadge } from "./PlatformBadge";

interface InfluencerCardProps {
  influencer: {
    id: string;
    full_name: string;
    platform?: string;
    platform_handle?: string;
    follower_count?: number;
    engagement_rate?: number;
    niche_categories?: string[];
    influencer_tier?: string;
  };
}

export function InfluencerCard({ influencer }: InfluencerCardProps) {
  const navigate = useNavigate();

  const formatFollowers = (count?: number) => {
    if (!count) return "0";
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toString();
  };

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          <Avatar className="h-12 w-12">
            <AvatarFallback>
              {influencer.full_name
                .split(" ")
                .map((n) => n[0])
                .join("")
                .toUpperCase()
                .slice(0, 2)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold truncate">{influencer.full_name}</h3>
            {influencer.platform_handle && (
              <p className="text-sm text-muted-foreground truncate">
                @{influencer.platform_handle}
              </p>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {influencer.platform && (
          <div className="flex gap-2">
            <PlatformBadge platform={influencer.platform} />
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <div>
            <p className="text-xs text-muted-foreground">Followers</p>
            <p className="text-lg font-bold">
              {formatFollowers(influencer.follower_count)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Engagement</p>
            <p className="text-lg font-bold">
              {influencer.engagement_rate?.toFixed(1) || "0"}%
            </p>
          </div>
        </div>

        {influencer.niche_categories && influencer.niche_categories.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {influencer.niche_categories.slice(0, 3).map((niche) => (
              <Badge key={niche} variant="secondary" className="text-xs">
                {niche}
              </Badge>
            ))}
          </div>
        )}

        {influencer.influencer_tier && (
          <Badge variant="outline">{influencer.influencer_tier}</Badge>
        )}

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => navigate(`/marketing/contacts/${influencer.id}`)}
          >
            <Eye className="h-3 w-3 mr-1" />
            View
          </Button>
          <Button size="sm" className="flex-1">
            <UserPlus className="h-3 w-3 mr-1" />
            Add to Campaign
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
