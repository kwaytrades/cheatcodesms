import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { TierBadge } from "@/components/ui/tier-badge";
import { LikelihoodScore } from "@/components/ui/likelihood-score";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface KeyMetricsProps {
  contactId: string;
  leadScore?: number;
  engagementScore?: number;
  totalSpent?: number;
  leadStatus?: string;
  lastContactDate?: string;
  customerTier?: string | null;
  likelihoodScore?: number | null;
  engagementLevel?: string | null;
  productsCount?: number;
  webinarCount?: number;
  lastScoreUpdate?: string | null;
  onScoreRefresh?: () => void;
}

export const KeyMetrics = ({ 
  contactId,
  leadScore = 0, 
  engagementScore = 0, 
  totalSpent = 0, 
  leadStatus = "new",
  lastContactDate,
  customerTier,
  likelihoodScore,
  engagementLevel,
  productsCount = 0,
  webinarCount = 0,
  lastScoreUpdate,
  onScoreRefresh
}: KeyMetricsProps) => {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefreshScores = async () => {
    setIsRefreshing(true);
    try {
      const { data, error } = await supabase.functions.invoke('update-contact-scores-realtime', {
        body: { 
          contactId,
          messageBody: null // Analyze full message history
        }
      });

      if (error) throw error;

      toast.success(`Scores updated! Lead Score: ${data.leadScore}, Status: ${data.leadStatus}`);
      
      // Trigger parent refresh
      if (onScoreRefresh) {
        onScoreRefresh();
      }
    } catch (error) {
      console.error('Error refreshing scores:', error);
      toast.error('Failed to refresh scores');
    } finally {
      setIsRefreshing(false);
    }
  };

  const getScoreFreshness = () => {
    if (!lastScoreUpdate) return 'text-destructive';
    const hoursSinceUpdate = (Date.now() - new Date(lastScoreUpdate).getTime()) / 3600000;
    if (hoursSinceUpdate < 1) return 'text-success';
    if (hoursSinceUpdate < 24) return 'text-warning';
    return 'text-destructive';
  };
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-score-hot';
    if (score >= 51) return 'text-score-warm';
    if (score >= 21) return 'text-score-cool';
    return 'text-score-cold';
  };

  const getStatusColor = (status: string) => {
    const statusMap: Record<string, string> = {
      'cold': 'bg-info/20 text-info border-info/30',
      'warm': 'bg-warning/20 text-warning border-warning/30',
      'hot': 'bg-destructive/20 text-destructive border-destructive/30',
      'customer': 'bg-status-customer/10 text-status-customer border-status-customer/20',
      'vip': 'bg-status-vip/10 text-status-vip border-status-vip/20',
      'churned': 'bg-status-churned/10 text-status-churned border-status-churned/20',
    };
    return statusMap[status?.toLowerCase()] || 'bg-muted text-muted-foreground';
  };

  const formatTimeAgo = (date?: string) => {
    if (!date) return "Never";
    const diff = Date.now() - new Date(date).getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours < 1) return "Just now";
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  return (
    <Card className="accent-left-purple card-gradient">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            📊 Key Metrics
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefreshScores}
            disabled={isRefreshing}
            className="h-7 px-2"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''} ${getScoreFreshness()}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {customerTier && (
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-muted-foreground">Tier</span>
              <TierBadge tier={customerTier} />
            </div>
          </div>
        )}

        {likelihoodScore !== null && likelihoodScore !== undefined && (
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-muted-foreground">Likelihood</span>
              <LikelihoodScore score={likelihoodScore} showLabel={true} />
            </div>
          </div>
        )}
        
        <div>
          <div className="flex justify-between items-center mb-1">
            <span className="text-muted-foreground">Status</span>
            <Badge className={getStatusColor(leadStatus)}>
              {leadStatus}
            </Badge>
          </div>
        </div>
        
        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-muted-foreground">Score</span>
            <div className="flex items-center gap-2">
              <span className={`font-bold ${getScoreColor(leadScore)}`}>{leadScore}/100</span>
              {lastScoreUpdate && (
                <span className={`text-xs ${getScoreFreshness()}`}>
                  {formatTimeAgo(lastScoreUpdate)}
                </span>
              )}
            </div>
          </div>
          <Progress value={leadScore} className="h-2" useGradient />
        </div>
        
        <div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Engagement</span>
            <span className="font-medium">{engagementScore}</span>
          </div>
        </div>
        
        <div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Spent</span>
            <span className="font-medium text-success">${(totalSpent ?? 0).toLocaleString()}</span>
          </div>
        </div>
        
        <div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Last Contact</span>
            <span className="font-medium">{formatTimeAgo(lastContactDate)}</span>
          </div>
        </div>

        {productsCount > 0 && (
          <div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Products</span>
              <span className="font-medium">{productsCount}</span>
            </div>
          </div>
        )}

        {webinarCount > 0 && (
          <div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Webinars</span>
              <span className="font-medium">{webinarCount}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
