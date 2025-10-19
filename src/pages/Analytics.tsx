import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Send, MessageSquare, Users, TrendingUp } from "lucide-react";

interface Stats {
  totalCampaigns: number;
  totalMessages: number;
  activeConversations: number;
  responseRate: number;
}

const Analytics = () => {
  const [stats, setStats] = useState<Stats>({
    totalCampaigns: 0,
    totalMessages: 0,
    activeConversations: 0,
    responseRate: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const [campaignsRes, messagesRes, conversationsRes] = await Promise.all([
        supabase.from("campaigns").select("*", { count: "exact" }),
        supabase.from("messages").select("*", { count: "exact" }),
        supabase.from("conversations").select("*", { count: "exact" }).eq("status", "active"),
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
        totalCampaigns: campaignsRes.count || 0,
        totalMessages: messagesRes.count || 0,
        activeConversations: conversationsRes.count || 0,
        responseRate,
      });
    } catch (error) {
      console.error("Error loading stats:", error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      title: "Total Campaigns",
      value: stats.totalCampaigns,
      icon: Send,
      description: "Campaigns sent all time",
      color: "text-primary",
    },
    {
      title: "Total Messages",
      value: stats.totalMessages,
      icon: MessageSquare,
      description: "Messages sent and received",
      color: "text-secondary",
    },
    {
      title: "Active Conversations",
      value: stats.activeConversations,
      icon: Users,
      description: "Ongoing customer chats",
      color: "text-warning",
    },
    {
      title: "Response Rate",
      value: `${stats.responseRate}%`,
      icon: TrendingUp,
      description: "Customer engagement",
      color: stats.responseRate > 50 ? "text-primary" : "text-destructive",
    },
  ];

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-32 bg-muted rounded"></div>
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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

      <Card className="border-border/50">
        <CardHeader>
          <CardTitle>Quick Start Guide</CardTitle>
          <CardDescription>Get started with your SMS marketing platform</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <Send className="h-4 w-4 text-primary" />
              1. Create Your First Campaign
            </h3>
            <p className="text-sm text-muted-foreground pl-6">
              Navigate to Campaigns and click "New Campaign" to start sending personalized SMS messages
            </p>
          </div>
          <div className="space-y-2">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-secondary" />
              2. Monitor Your Inbox
            </h3>
            <p className="text-sm text-muted-foreground pl-6">
              Check the Inbox to see real-time customer responses and AI agent interactions
            </p>
          </div>
          <div className="space-y-2">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-warning" />
              3. Track Performance
            </h3>
            <p className="text-sm text-muted-foreground pl-6">
              Use this dashboard to monitor campaign success and customer engagement metrics
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Analytics;
