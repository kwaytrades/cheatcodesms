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
  likelihoodScore?: number | null;
  engagementLevel?: string | null;
  totalSpent?: number | null;
  leadStatus?: string | null;
  customerTier?: string | null;
  lastContactDate?: string | null;
  productsCount?: number;
  webinarCount?: number;
  lastScoreUpdate?: string | null;
  onScoreRefresh?: () => void;
}

export const KeyMetrics = ({
  contactId,
  likelihoodScore = 0,
  engagementLevel,
  totalSpent = 0,
  leadStatus,
  customerTier,
  lastContactDate,
  productsCount = 0,
  webinarCount = 0,
  lastScoreUpdate,
  onScoreRefresh,
}: KeyMetricsProps) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isEditingTier, setIsEditingTier] = useState(false);

  const handleRefreshScores = async () => {
    setIsRefreshing(true);
    try {
      const { data, error } = await supabase.functions.invoke('update-contact-scores-realtime', {
        body: { 
          contactId,
          messageBody: null,
          force: true
        }
      });

      if (error) throw error;

      if (data?.scores?.likelihood_to_buy_score) {
        toast.success("Score refreshed successfully");
        onScoreRefresh?.();
      }
    } catch (error: any) {
      console.error("Error refreshing score:", error);
      toast.error(error.message || "Failed to refresh score");
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

  const getScoreFreshness = (date?: string) => {
    if (!date) return 'stale';
    const hoursSinceUpdate = (Date.now() - new Date(date).getTime()) / 3600000;
    if (hoursSinceUpdate < 1) return 'fresh';
    if (hoursSinceUpdate < 24) return 'moderate';
    return 'stale';
  };

  const getScoreColor = (score?: number | null) => {
    const s = score || 0;
    if (s >= 80) return 'text-[hsl(120,100%,50%)]';
    if (s >= 70) return 'text-[hsl(0,100%,60%)]';
    if (s >= 50) return 'text-[hsl(30,100%,55%)]';
    if (s >= 30) return 'text-[hsl(180,100%,45%)]';
    return 'text-[hsl(210,100%,55%)]';
  };

  const getStatusColor = (status?: string | null) => {
    const statusMap: Record<string, string> = {
      'cold': 'bg-info/20 text-info border-info/30',
      'warm': 'bg-warning/20 text-warning border-warning/30',
      'hot': 'bg-destructive/20 text-destructive border-destructive/30',
      'customer': 'bg-status-customer/10 text-status-customer border-status-customer/20',
      'vip': 'bg-status-vip/10 text-status-vip border-status-vip/20',
      'churned': 'bg-status-churned/10 text-status-churned border-status-churned/20',
    };
    return statusMap[status?.toLowerCase() || ''] || 'bg-muted text-muted-foreground';
  };

  const formatTimeAgo = (date?: string | null) => {
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
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefreshScores}
              disabled={isRefreshing}
              className="h-7 px-2"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground mb-2">Customer Tier</p>
          <div className="flex items-center gap-2">
            {!isEditingTier ? (
              <>
                <TierBadge tier={customerTier || 'Lead'} />
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
              <Select value={customerTier || 'Lead'} onValueChange={handleTierChange}>
                <SelectTrigger className="h-7 w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Lead">Lead</SelectItem>
                  <SelectItem value="Level 1">Level 1</SelectItem>
                  <SelectItem value="Level 2">Level 2</SelectItem>
                  <SelectItem value="Level 3">Level 3</SelectItem>
                  <SelectItem value="VIP">VIP</SelectItem>
                  <SelectItem value="Premium">Premium</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        <div>
          <p className="text-sm font-medium text-muted-foreground mb-2">Lead Status</p>
          <LeadStatusBadge score={likelihoodScore || 0} status={leadStatus || 'new'} />
        </div>

        <div>
          <p className="text-sm font-medium text-muted-foreground mb-2">Likelihood to Buy Score</p>
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <Progress value={likelihoodScore || 0} className="h-2" />
            </div>
            <span className={`text-2xl font-bold ${getScoreColor(likelihoodScore)}`}>
              {likelihoodScore || 0}
            </span>
          </div>
          {lastScoreUpdate && (
            <p className="text-xs text-muted-foreground mt-1">
              Updated {formatTimeAgo(lastScoreUpdate)} ({getScoreFreshness(lastScoreUpdate)})
            </p>
          )}
        </div>

        <div>
          <p className="text-sm font-medium text-muted-foreground mb-2">Total Spent</p>
          <p className="text-xl font-bold text-success">${(totalSpent || 0).toLocaleString()}</p>
        </div>

        <div>
          <p className="text-sm font-medium text-muted-foreground mb-2">Last Contact</p>
          <p className="text-sm">{formatTimeAgo(lastContactDate)}</p>
        </div>

        {productsCount > 0 && (
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-2">Products Owned</p>
            <p className="text-sm font-semibold">{productsCount}</p>
          </div>
        )}

        {webinarCount > 0 && (
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-2">Webinars Attended</p>
            <p className="text-sm font-semibold">{webinarCount}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
