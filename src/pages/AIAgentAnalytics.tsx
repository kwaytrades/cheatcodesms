import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bot, BarChart3, Settings, Layers } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState } from "react";

export default function AIAgentAnalytics() {
  const navigate = useNavigate();
  const [period, setPeriod] = useState("30");

  const { data: metrics } = useQuery({
    queryKey: ["agent-metrics", period],
    queryFn: async () => {
      const startDate = new Date(Date.now() - parseInt(period) * 24 * 60 * 60 * 1000).toISOString();
      
      const { data, error } = await supabase
        .from("agent_performance_metrics")
        .select("*")
        .gte("period_start", startDate)
        .order("period_start", { ascending: true });

      if (error) throw error;
      return data;
    },
  });

  const chartData = metrics?.map((m) => ({
    type: m.agent_type,
    replyRate: m.reply_rate || 0,
    conversionRate: m.conversion_rate || 0,
    revenue: m.revenue_generated || 0,
  })) || [];

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">AI Agent Analytics</h1>
          <p className="text-muted-foreground">Performance insights and metrics</p>
        </div>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Tabs value="analytics" className="w-full">
        <TabsList>
          <TabsTrigger value="dashboard" onClick={() => navigate("/agents")}>
            <Bot className="w-4 h-4 mr-2" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="analytics" onClick={() => navigate("/agents/analytics")}>
            <BarChart3 className="w-4 h-4 mr-2" />
            Analytics
          </TabsTrigger>
          <TabsTrigger value="types" onClick={() => navigate("/agents/types")}>
            <Layers className="w-4 h-4 mr-2" />
            Agent Types
          </TabsTrigger>
          <TabsTrigger value="settings" onClick={() => navigate("/agents/settings")}>
            <Settings className="w-4 h-4 mr-2" />
            Settings
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Total Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              ${metrics?.reduce((sum, m) => sum + (m.revenue_generated || 0), 0).toFixed(2)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Avg Reply Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {(metrics?.reduce((sum, m) => sum + (m.reply_rate || 0), 0) / (metrics?.length || 1)).toFixed(1)}%
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Avg Conversion Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {(metrics?.reduce((sum, m) => sum + (m.conversion_rate || 0), 0) / (metrics?.length || 1)).toFixed(1)}%
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Performance by Agent Type</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="type" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="replyRate" fill="hsl(var(--primary))" name="Reply Rate %" />
              <Bar dataKey="conversionRate" fill="hsl(var(--secondary))" name="Conversion Rate %" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Revenue by Agent Type</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="type" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="revenue" fill="hsl(var(--primary))" name="Revenue ($)" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
