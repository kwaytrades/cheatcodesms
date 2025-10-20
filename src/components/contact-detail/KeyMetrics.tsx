import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

interface KeyMetricsProps {
  leadScore?: number;
  engagementScore?: number;
  totalSpent?: number;
  leadStatus?: string;
  lastContactDate?: string;
}

export const KeyMetrics = ({
  leadScore = 0,
  engagementScore = 0,
  totalSpent = 0,
  leadStatus = "new",
  lastContactDate
}: KeyMetricsProps) => {
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
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          📊 Key Metrics
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
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
            <span className={`font-bold ${getScoreColor(leadScore)}`}>{leadScore}/100</span>
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
            <span className="font-medium text-success">${totalSpent.toLocaleString()}</span>
          </div>
        </div>
        
        <div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Last Contact</span>
            <span className="font-medium">{formatTimeAgo(lastContactDate)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
