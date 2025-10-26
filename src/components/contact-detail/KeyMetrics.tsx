import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { TierBadge } from "@/components/ui/tier-badge";
import { LeadStatusBadge } from "@/components/ui/lead-status-badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RefreshCw, Pencil } from "lucide-react";
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
  const [isEditingTier, setIsEditingTier] = useState(false);

  const handleRefreshScores = async () => {
    setIsRefreshing(true);
    try {
      const { data, error } = await supabase.functions.invoke('update-contact-scores-realtime', {
        body: { 
          contactId,
          messageBody: null, // Analyze full message history
          force: true
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

  const handleTierChange = async (newTier: string) => {
    try {
      const { data: contact, error: fetchError } = await supabase
        .from('contacts')
        .select('metadata')
        .eq('id', contactId)
        .single();

      if (fetchError) throw fetchError;

      const currentMetadata = (contact?.metadata as any) || {};

      const { error } = await supabase
        .from('contacts')
        .update({ 
          customer_tier: newTier,
          metadata: { 
            ...currentMetadata, 
            tier_manually_set: true,
            tier_set_at: new Date().toISOString()
          }
        })
        .eq('id', contactId);
      
      if (error) throw error;
      
      toast.success(`Tier updated to ${newTier}`);
      setIsEditingTier(false);
      
      if (onScoreRefresh) {
        onScoreRefresh();
      }
    } catch (error) {
      console.error('Error updating tier:', error);
      toast.error('Failed to update tier');
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
    if (score >= 80) return 'text-[hsl(120,100%,50%)]'; // Lime green - READY
    if (score >= 70) return 'text-[hsl(0,100%,60%)]'; // Red - Hot
    if (score >= 50) return 'text-[hsl(30,100%,55%)]'; // Orange - Warm
    if (score >= 30) return 'text-[hsl(180,100%,45%)]'; // Cyan - Nurture
    return 'text-[hsl(210,100%,55%)]'; // Blue - Cold
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
              <div className="flex items-center gap-2">
                {!isEditingTier ? (
                  <>
                    <TierBadge tier={customerTier} />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsEditingTier(true)}
                      className="h-6 w-6 p-0"
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                  </>
                ) : (
                  <Select value={customerTier} onValueChange={handleTierChange}>
                    <SelectTrigger className="h-7 w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LEAD">LEAD</SelectItem>
                      <SelectItem value="Level 1">Level 1</SelectItem>
                      <SelectItem value="Level 2">Level 2</SelectItem>
                      <SelectItem value="Level 3">Level 3</SelectItem>
                      <SelectItem value="VIP">VIP</SelectItem>
                      <SelectItem value="SHITLIST">SHITLIST</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
          </div>
        )}

        <div>
          <div className="flex justify-between items-center mb-1">
            <span className="text-muted-foreground">Status</span>
            <LeadStatusBadge score={leadScore} status={leadStatus} />
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
          <Progress value={leadScore} className="h-2" useGradient isReady={leadScore >= 80} />
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
