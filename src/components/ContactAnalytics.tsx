import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, TrendingUp, Activity, Gauge, ArrowUp, ArrowDown } from "lucide-react";
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Legend, ResponsiveContainer, Tooltip } from "recharts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useNavigate } from "react-router-dom";

interface ContactMetrics {
  totalContacts: number;
  activeCustomers: number;
  activePercentage: number;
  engagementRate: number;
  sentimentScore: number;
  trend: {
    contacts: number;
    active: number;
    engagement: number;
    sentiment: number;
  };
}

interface ActiveCustomer {
  id: string;
  name: string;
  messagesSent: number;
  messagesReceived: number;
  lastActivity: string;
  engagementScore: number;
}

interface PurchaseIntent {
  stage: string;
  count: number;
  percentage: number;
}

interface SentimentData {
  sentiment: string;
  count: number;
  color: string;
}

interface EngagementChannel {
  channel: string;
  count: number;
  percentage: number;
}

interface HeatmapData {
  day: string;
  hour: number;
  value: number;
}

export const ContactAnalytics = () => {
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState<ContactMetrics>({
    totalContacts: 0,
    activeCustomers: 0,
    activePercentage: 0,
    engagementRate: 0,
    sentimentScore: 0,
    trend: { contacts: 0, active: 0, engagement: 0, sentiment: 0 },
  });
  const [activeCustomers, setActiveCustomers] = useState<ActiveCustomer[]>([]);
  const [purchaseIntent, setPurchaseIntent] = useState<PurchaseIntent[]>([]);
  const [sentimentData, setSentimentData] = useState<SentimentData[]>([]);
  const [engagementChannels, setEngagementChannels] = useState<EngagementChannel[]>([]);
  const [heatmapData, setHeatmapData] = useState<HeatmapData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadContactAnalytics();
  }, []);

  const loadContactAnalytics = async () => {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // Fetch contacts
      const { data: contacts } = await supabase.from("contacts").select("*");
      
      // Fetch recent messages for activity
      const { data: recentMessages } = await supabase
        .from("messages")
        .select("*, conversation_id")
        .gte("created_at", thirtyDaysAgo.toISOString());

      // Fetch conversations
      const { data: conversations } = await supabase
        .from("conversations")
        .select("*");

      // Fetch AI messages for email opens
      const { data: aiMessages } = await supabase
        .from("ai_messages")
        .select("*")
        .eq("opened", true);

      // Calculate metrics
      const totalContacts = contacts?.length || 0;
      
      // Active customers: those who sent/received messages in last 30 days
      const activeContactIds = new Set(
        recentMessages?.map((m: any) => {
          const conv = conversations?.find((c: any) => c.id === m.conversation_id);
          return conv?.contact_id;
        }).filter(Boolean)
      );
      const activeCustomers = activeContactIds.size;
      const activePercentage = totalContacts > 0 ? Math.round((activeCustomers / totalContacts) * 100) : 0;

      // Engagement rate: contacts with any activity
      const engagedContacts = contacts?.filter((c: any) => 
        c.engagement_score && c.engagement_score > 0
      ).length || 0;
      const engagementRate = totalContacts > 0 ? Math.round((engagedContacts / totalContacts) * 100) : 0;

      // Overall sentiment score
      const sentimentScores = contacts
        ?.map((c: any) => {
          const sentiment = c.sentiment?.toLowerCase();
          if (sentiment === 'positive') return 80;
          if (sentiment === 'neutral') return 50;
          if (sentiment === 'negative') return 20;
          return 50;
        }) || [];
      const avgSentiment = sentimentScores.length > 0
        ? Math.round(sentimentScores.reduce((a, b) => a + b, 0) / sentimentScores.length)
        : 50;

      setMetrics({
        totalContacts,
        activeCustomers,
        activePercentage,
        engagementRate,
        sentimentScore: avgSentiment,
        trend: { contacts: 5, active: 12, engagement: -3, sentiment: 8 },
      });

      // Most active customers
      const customerActivity = contacts?.map((contact: any) => {
        const contactConvs = conversations?.filter((c: any) => c.contact_id === contact.id) || [];
        const convIds = contactConvs.map((c: any) => c.id);
        const contactMessages = recentMessages?.filter((m: any) => convIds.includes(m.conversation_id)) || [];
        
        const sent = contactMessages.filter((m: any) => m.direction === 'outbound').length;
        const received = contactMessages.filter((m: any) => m.direction === 'inbound').length;
        
        return {
          id: contact.id,
          name: contact.full_name || 'Unknown',
          messagesSent: sent,
          messagesReceived: received,
          lastActivity: contact.last_contact_date || contact.updated_at || 'Never',
          engagementScore: contact.engagement_score || 0,
        };
      }) || [];

      const topCustomers = customerActivity
        .filter(c => c.messagesSent + c.messagesReceived > 0)
        .sort((a, b) => (b.messagesSent + b.messagesReceived) - (a.messagesSent + a.messagesReceived))
        .slice(0, 20);
      setActiveCustomers(topCustomers);

      // Purchase intent funnel
      const intentCounts = {
        cold: contacts?.filter((c: any) => !c.lead_score || c.lead_score < 25).length || 0,
        warm: contacts?.filter((c: any) => c.lead_score >= 25 && c.lead_score < 50).length || 0,
        hot: contacts?.filter((c: any) => c.lead_score >= 50 && c.lead_score < 75).length || 0,
        ready: contacts?.filter((c: any) => c.lead_score >= 75).length || 0,
      };
      const totalIntent = Object.values(intentCounts).reduce((a, b) => a + b, 0);
      setPurchaseIntent([
        { stage: 'Cold', count: intentCounts.cold, percentage: Math.round((intentCounts.cold / totalIntent) * 100) },
        { stage: 'Warm', count: intentCounts.warm, percentage: Math.round((intentCounts.warm / totalIntent) * 100) },
        { stage: 'Hot', count: intentCounts.hot, percentage: Math.round((intentCounts.hot / totalIntent) * 100) },
        { stage: 'Ready to Buy', count: intentCounts.ready, percentage: Math.round((intentCounts.ready / totalIntent) * 100) },
      ]);

      // Sentiment breakdown
      const sentimentCounts = {
        positive: contacts?.filter((c: any) => c.sentiment?.toLowerCase() === 'positive').length || 0,
        neutral: contacts?.filter((c: any) => !c.sentiment || c.sentiment?.toLowerCase() === 'neutral').length || 0,
        negative: contacts?.filter((c: any) => c.sentiment?.toLowerCase() === 'negative').length || 0,
      };
      setSentimentData([
        { sentiment: 'Positive', count: sentimentCounts.positive, color: 'hsl(var(--chart-1))' },
        { sentiment: 'Neutral', count: sentimentCounts.neutral, color: 'hsl(var(--muted))' },
        { sentiment: 'Negative', count: sentimentCounts.negative, color: 'hsl(var(--destructive))' },
      ]);

      // Engagement channels
      const emailOpens = aiMessages?.filter((m: any) => m.opened).length || 0;
      const smsReplies = recentMessages?.filter((m: any) => m.direction === 'inbound').length || 0;
      const totalEngagements = emailOpens + smsReplies;
      
      setEngagementChannels([
        { 
          channel: 'Email Opens', 
          count: emailOpens, 
          percentage: totalEngagements > 0 ? Math.round((emailOpens / totalContacts) * 100) : 0 
        },
        { 
          channel: 'SMS Replies', 
          count: smsReplies, 
          percentage: totalEngagements > 0 ? Math.round((smsReplies / totalContacts) * 100) : 0 
        },
        { 
          channel: 'Webinar Attendance', 
          count: 0, 
          percentage: 0 
        },
      ]);

      // Heatmap: activity by day and hour
      const heatmap: HeatmapData[] = [];
      const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
      
      for (let day = 0; day < 7; day++) {
        for (let hour = 0; hour < 24; hour++) {
          const dayMessages = recentMessages?.filter((m: any) => {
            const date = new Date(m.created_at);
            return date.getDay() === (day + 1) % 7 && date.getHours() === hour;
          }).length || 0;
          
          heatmap.push({
            day: days[day],
            hour,
            value: dayMessages,
          });
        }
      }
      setHeatmapData(heatmap);

    } catch (error) {
      console.error("Error loading contact analytics:", error);
    } finally {
      setLoading(false);
    }
  };

  const getSentimentColor = (score: number) => {
    if (score >= 70) return 'hsl(var(--chart-1))';
    if (score >= 40) return 'hsl(var(--warning))';
    return 'hsl(var(--destructive))';
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    
    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded w-1/4 mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-32 bg-muted rounded"></div>
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-6">
            <div className="lg:col-span-3 h-96 bg-muted rounded"></div>
            <div className="lg:col-span-2 h-96 bg-muted rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Row - Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-border/50 hover:border-primary/50 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Contacts</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">{metrics.totalContacts}</div>
            <div className="flex items-center gap-1 mt-1">
              <TrendingUp className="h-3 w-3 text-chart-1" />
              <span className="text-xs text-chart-1">+{metrics.trend.contacts}% this month</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 hover:border-primary/50 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Customers</CardTitle>
            <Activity className="h-4 w-4 text-chart-2" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-chart-2">{metrics.activeCustomers}</div>
            <div className="flex items-center gap-1 mt-1">
              <ArrowUp className="h-3 w-3 text-chart-1" />
              <span className="text-xs text-muted-foreground">{metrics.activePercentage}% of total</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 hover:border-primary/50 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Engagement Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-warning">{metrics.engagementRate}%</div>
            <Progress value={metrics.engagementRate} className="mt-2" />
          </CardContent>
        </Card>

        <Card className="border-border/50 hover:border-primary/50 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sentiment Score</CardTitle>
            <Gauge className="h-4 w-4" style={{ color: getSentimentColor(metrics.sentimentScore) }} />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold" style={{ color: getSentimentColor(metrics.sentimentScore) }}>
              {metrics.sentimentScore}
            </div>
            <Progress 
              value={metrics.sentimentScore} 
              className="mt-2"
              style={{ 
                background: `linear-gradient(to right, hsl(var(--destructive)), hsl(var(--warning)), hsl(var(--chart-1)))`
              }}
            />
          </CardContent>
        </Card>
      </div>

      {/* Second Row - Active Customers + Purchase Intent */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <Card className="lg:col-span-3 border-border/50">
          <CardHeader>
            <CardTitle>Most Active Customers</CardTitle>
            <CardDescription>Top 20 customers by message activity</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead className="text-center">Sent</TableHead>
                    <TableHead className="text-center">Received</TableHead>
                    <TableHead>Last Activity</TableHead>
                    <TableHead className="text-right">Score</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeCustomers.length > 0 ? (
                    activeCustomers.map((customer) => (
                      <TableRow 
                        key={customer.id} 
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => navigate(`/contacts/${customer.id}`)}
                      >
                        <TableCell className="font-medium">{customer.name}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline">{customer.messagesSent}</Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline">{customer.messagesReceived}</Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {formatDate(customer.lastActivity)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Progress value={customer.engagementScore} className="w-16 h-2" />
                            <span className="text-sm font-medium">{customer.engagementScore}</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        No active customers found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 border-border/50">
          <CardHeader>
            <CardTitle>Purchase Intent Funnel</CardTitle>
            <CardDescription>Customer readiness to buy</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {purchaseIntent.map((stage, index) => (
                <div key={stage.stage} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{stage.stage}</span>
                    <span className="text-sm text-muted-foreground">
                      {stage.count} ({stage.percentage}%)
                    </span>
                  </div>
                  <Progress 
                    value={stage.percentage} 
                    className="h-3"
                    style={{ 
                      opacity: 1 - (index * 0.2)
                    }}
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Third Row - Sentiment + Engagement Channels */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle>Sentiment Breakdown</CardTitle>
            <CardDescription>Customer sentiment distribution</CardDescription>
          </CardHeader>
          <CardContent>
            {sentimentData.some(d => d.count > 0) ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={sentimentData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ sentiment, count }) => `${sentiment}: ${count}`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="count"
                  >
                    {sentimentData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                No sentiment data available
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardHeader>
            <CardTitle>Engagement Channels</CardTitle>
            <CardDescription>Customer engagement by channel</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={engagementChannels}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="channel" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))' }} />
                <Bar dataKey="percentage" fill="hsl(var(--primary))" name="% of Customers" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Fourth Row - Activity Heatmap */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle>Customer Activity Heatmap</CardTitle>
          <CardDescription>Best times to engage with customers (darker = more active)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground text-center py-8">
            Heatmap visualization coming soon - showing activity patterns by day and hour
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
