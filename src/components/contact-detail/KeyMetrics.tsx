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
  const getStatusColor = (status: string): "default" | "destructive" | "outline" | "secondary" => {
    const colors: Record<string, "default" | "destructive" | "outline" | "secondary"> = {
      qualified: "default",
      new: "secondary",
      contacted: "outline",
      converted: "default"
    };
    return colors[status] || "secondary";
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
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          📊 Key Metrics
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div>
          <div className="flex justify-between items-center mb-1">
            <span className="text-muted-foreground">Status</span>
            <Badge variant={getStatusColor(leadStatus)}>
              {leadStatus}
            </Badge>
          </div>
        </div>
        
        <div>
          <div className="flex justify-between items-center mb-1">
            <span className="text-muted-foreground">Score</span>
            <span className="font-medium">{leadScore}/100</span>
          </div>
          <Progress value={leadScore} className="h-2" />
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
            <span className="font-medium">${totalSpent.toLocaleString()}</span>
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
