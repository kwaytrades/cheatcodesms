import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Send, MessageSquare, Users, TrendingUp, AlertCircle, CheckCircle2, XCircle } from "lucide-react";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Legend, ResponsiveContainer } from "recharts";

interface Stats {
  totalCampaigns: number;
  totalMessages: number;
  activeConversations: number;
  responseRate: number;
  totalContacts: number;
}

interface CampaignData {
  name: string;
  sent: number;
  delivered: number;
  failed: number;
  replies: number;
}

interface ContactStatusData {
  status: string;
  count: number;
}

interface MessageTrendData {
  date: string;
  sent: number;
  received: number;
}

const Analytics = () => {
  const [stats, setStats] = useState<Stats>({
    totalCampaigns: 0,
    totalMessages: 0,
    activeConversations: 0,
    responseRate: 0,
    totalContacts: 0,
  });
  const [campaignData, setCampaignData] = useState<CampaignData[]>([]);
  const [contactStatusData, setContactStatusData] = useState<ContactStatusData[]>([]);
  const [deliveryData, setDeliveryData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const [campaignsRes, messagesRes, conversationsRes, contactsRes] = await Promise.all([
        supabase.from("campaigns").select("*"),
        supabase.from("messages").select("*", { count: "exact" }),
        supabase.from("conversations").select("*", { count: "exact" }).eq("status", "active"),
        supabase.from("contacts").select("status"),
      ]);

      const totalOutbound = await supabase
        .from("messages")
        .select("*", { count: "exact" })
        .eq("direction", "outbound");

      const totalInbound = await supabase
        .from("messages")
        .select("*", { count: "exact" })
        .eq("direction", "inbound");

      const responseRate =
        totalOutbound.count && totalInbound.count
          ? Math.round((totalInbound.count / totalOutbound.count) * 100)
          : 0;

      setStats({
        totalCampaigns: campaignsRes.data?.length || 0,
        totalMessages: messagesRes.count || 0,
        activeConversations: conversationsRes.count || 0,
        responseRate,
        totalContacts: contactsRes.data?.length || 0,
      });

      // Campaign performance data
      if (campaignsRes.data) {
        const campData = campaignsRes.data.map((camp: any) => ({
          name: camp.name.length > 15 ? camp.name.substring(0, 15) + '...' : camp.name,
          sent: camp.sent_count || 0,
          delivered: camp.delivered_count || 0,
          failed: camp.failed_count || 0,
          replies: camp.reply_count || 0,
        }));
        setCampaignData(campData);
      }

      // Contact status distribution
      if (contactsRes.data) {
        const statusCounts: Record<string, number> = {};
        contactsRes.data.forEach((contact: any) => {
          const status = contact.status || 'Unknown';
          statusCounts[status] = (statusCounts[status] || 0) + 1;
        });
        const statusData = Object.entries(statusCounts).map(([status, count]) => ({
          status,
          count,
        }));
        setContactStatusData(statusData);
      }

      // Message delivery breakdown
      const totalSent = campaignsRes.data?.reduce((sum: number, c: any) => sum + (c.sent_count || 0), 0) || 0;
      const totalDelivered = campaignsRes.data?.reduce((sum: number, c: any) => sum + (c.delivered_count || 0), 0) || 0;
      const totalFailed = campaignsRes.data?.reduce((sum: number, c: any) => sum + (c.failed_count || 0), 0) || 0;
      
      setDeliveryData([
        { name: 'Sent', value: totalSent, color: 'hsl(var(--primary))' },
        { name: 'Delivered', value: totalDelivered, color: 'hsl(var(--chart-2))' },
        { name: 'Failed', value: totalFailed, color: 'hsl(var(--destructive))' },
      ]);

    } catch (error) {
      console.error("Error loading stats:", error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      title: "Total Contacts",
      value: stats.totalContacts,
      icon: Users,
      description: "Synced from Monday.com",
      color: "text-primary",
    },
    {
      title: "Total Campaigns",
      value: stats.totalCampaigns,
      icon: Send,
      description: "Campaigns sent all time",
      color: "text-secondary",
    },
    {
      title: "Total Messages",
      value: stats.totalMessages,
      icon: MessageSquare,
      description: "Messages sent and received",
      color: "text-warning",
    },
    {
      title: "Active Conversations",
      value: stats.activeConversations,
      icon: Users,
      description: "Ongoing customer chats",
      color: "text-secondary",
    },
    {
      title: "Response Rate",
      value: `${stats.responseRate}%`,
      icon: TrendingUp,
      description: "Customer engagement",
      color: stats.responseRate > 50 ? "text-primary" : "text-destructive",
    },
  ];

  const COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-32 bg-muted rounded"></div>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-80 bg-muted rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Analytics Dashboard</h1>
        <p className="text-muted-foreground">Monitor your SMS marketing performance</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title} className="border-border/50 hover:border-primary/50 transition-colors">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                <Icon className={`h-4 w-4 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
                <p className="text-xs text-muted-foreground mt-1">{stat.description}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Campaign Performance */}
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle>Campaign Performance</CardTitle>
            <CardDescription>Messages sent, delivered, failed, and replies per campaign</CardDescription>
          </CardHeader>
          <CardContent>
            {campaignData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={campaignData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Legend />
                  <Bar dataKey="sent" fill="hsl(var(--primary))" name="Sent" />
                  <Bar dataKey="delivered" fill="hsl(var(--chart-2))" name="Delivered" />
                  <Bar dataKey="failed" fill="hsl(var(--destructive))" name="Failed" />
                  <Bar dataKey="replies" fill="hsl(var(--chart-4))" name="Replies" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                No campaign data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Message Delivery Status */}
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle>Message Delivery Status</CardTitle>
            <CardDescription>Overall delivery performance across all campaigns</CardDescription>
          </CardHeader>
          <CardContent>
            {deliveryData.some(d => d.value > 0) ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={deliveryData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: ${value}`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {deliveryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <ChartTooltip content={<ChartTooltipContent />} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                No delivery data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Contact Status Distribution */}
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle>Contact Status Distribution</CardTitle>
            <CardDescription>Breakdown of contacts by status</CardDescription>
          </CardHeader>
          <CardContent>
            {contactStatusData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={contactStatusData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ status, count }) => `${status}: ${count}`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="count"
                  >
                    {contactStatusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <ChartTooltip content={<ChartTooltipContent />} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                No contact data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Engagement Metrics */}
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle>Engagement Overview</CardTitle>
            <CardDescription>Key engagement indicators</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-8 w-8 text-chart-2" />
                <div>
                  <p className="text-sm text-muted-foreground">Average Delivery Rate</p>
                  <p className="text-2xl font-bold">
                    {campaignData.length > 0
                      ? Math.round(
                          (campaignData.reduce((sum, c) => sum + c.delivered, 0) /
                            campaignData.reduce((sum, c) => sum + c.sent, 0)) *
                            100
                        ) || 0
                      : 0}%
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <XCircle className="h-8 w-8 text-destructive" />
                <div>
                  <p className="text-sm text-muted-foreground">Average Failure Rate</p>
                  <p className="text-2xl font-bold">
                    {campaignData.length > 0
                      ? Math.round(
                          (campaignData.reduce((sum, c) => sum + c.failed, 0) /
                            campaignData.reduce((sum, c) => sum + c.sent, 0)) *
                            100
                        ) || 0
                      : 0}%
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <MessageSquare className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">Average Reply Rate</p>
                  <p className="text-2xl font-bold">
                    {campaignData.length > 0
                      ? Math.round(
                          (campaignData.reduce((sum, c) => sum + c.replies, 0) /
                            campaignData.reduce((sum, c) => sum + c.sent, 0)) *
                            100
                        ) || 0
                      : 0}%
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Analytics;
