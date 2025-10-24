import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, DollarSign, TrendingUp, Activity, BarChart3, Target, Bot } from "lucide-react";
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { TradeAnalysisKnowledgeBase } from "@/components/cheat-code-ai/TradeAnalysisKnowledgeBase";
import { TradeAnalysisStyleGuide } from "@/components/cheat-code-ai/TradeAnalysisStyleGuide";
import { SystemPromptEditor } from "@/components/cheat-code-ai/SystemPromptEditor";
import { GuardrailsSettings } from "@/components/cheat-code-ai/GuardrailsSettings";

export default function Dashboard() {
  const { data: users } = useQuery({
    queryKey: ['cheat-code-users-count'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_subscriptions')
        .select('id', { count: 'exact' })
        .in('status', ['trial', 'active']);
      if (error) throw error;
      return data?.length || 0;
    }
  });

  const { data: tierDistribution } = useQuery({
    queryKey: ['tier-distribution'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_subscriptions')
        .select('tier_id, subscription_tiers(name)')
        .in('status', ['trial', 'active']);
      if (error) throw error;
      
      const distribution: Record<string, number> = {};
      data?.forEach(sub => {
        const tierName = (sub.subscription_tiers as any)?.name || 'Unknown';
        distribution[tierName] = (distribution[tierName] || 0) + 1;
      });
      
      return Object.entries(distribution).map(([name, value]) => ({
        name,
        value
      }));
    }
  });

  const { data: analysesCount } = useQuery({
    queryKey: ['analyses-count-30d'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stock_analyses')
        .select('id', { count: 'exact' })
        .gte('requested_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());
      if (error) throw error;
      return data?.length || 0;
    }
  });

  const { data: analysesTrend } = useQuery({
    queryKey: ['analyses-trend'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stock_analyses')
        .select('requested_at')
        .gte('requested_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
        .order('requested_at');
      if (error) throw error;
      
      const dailyData: Record<string, number> = {};
      data?.forEach(analysis => {
        const date = new Date(analysis.requested_at).toISOString().split('T')[0];
        dailyData[date] = (dailyData[date] || 0) + 1;
      });
      
      return Object.entries(dailyData)
        .map(([date, count]) => ({ date, count }))
        .slice(-14);
    }
  });

  const { data: topStocks } = useQuery({
    queryKey: ['top-stocks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stock_analyses')
        .select('symbol, technical_score, sentiment')
        .gte('requested_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());
      if (error) throw error;
      
      const stockData: Record<string, { count: number, avgScore: number, sentiment: string }> = {};
      data?.forEach(analysis => {
        if (!stockData[analysis.symbol]) {
          stockData[analysis.symbol] = { count: 0, avgScore: 0, sentiment: analysis.sentiment || 'neutral' };
        }
        stockData[analysis.symbol].count++;
        stockData[analysis.symbol].avgScore += analysis.technical_score || 0;
      });
      
      return Object.entries(stockData)
        .map(([symbol, data]) => ({
          symbol,
          count: data.count,
          avgScore: Math.round(data.avgScore / data.count),
          sentiment: data.sentiment
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);
    }
  });

  const COLORS = ['hsl(var(--primary))', 'hsl(var(--info))', 'hsl(var(--warning))', 'hsl(var(--purple))'];

  return (
    <div className="p-6 space-y-6">
      {/* Agent Configuration Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            <div>
              <CardTitle>Agent Configuration</CardTitle>
              <CardDescription>
                Manage knowledge base, style guides, and behavior settings for the Trade Analysis Agent
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="knowledge" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="knowledge">Knowledge Base</TabsTrigger>
              <TabsTrigger value="style">Style Guide</TabsTrigger>
              <TabsTrigger value="prompts">System Prompts</TabsTrigger>
              <TabsTrigger value="guardrails">Guardrails</TabsTrigger>
            </TabsList>
            
            <TabsContent value="knowledge" className="mt-6">
              <TradeAnalysisKnowledgeBase />
            </TabsContent>
            
            <TabsContent value="style" className="mt-6">
              <TradeAnalysisStyleGuide />
            </TabsContent>
            
            <TabsContent value="prompts" className="mt-6">
              <SystemPromptEditor />
            </TabsContent>
            
            <TabsContent value="guardrails" className="mt-6">
              <GuardrailsSettings />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Metrics Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{users || 0}</div>
            <p className="text-xs text-muted-foreground">Active subscriptions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Analyses (30d)</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analysesCount || 0}</div>
            <p className="text-xs text-muted-foreground">Total analyses run</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Credits Used</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{users ? Math.round((analysesCount || 0) / users * 10) / 10 : 0}</div>
            <p className="text-xs text-muted-foreground">Per user per month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Today</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">-</div>
            <p className="text-xs text-muted-foreground">Users active today</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Analyses Trend (14 days)</CardTitle>
            <CardDescription>Daily analysis requests</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={analysesTrend || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" />
                <YAxis stroke="hsl(var(--muted-foreground))" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                />
                <Line type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Subscription Distribution</CardTitle>
            <CardDescription>Users by tier</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={tierDistribution || []}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="hsl(var(--primary))"
                  dataKey="value"
                >
                  {tierDistribution?.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Top Analyzed Stocks (7 days)</CardTitle>
          <CardDescription>Most requested stock analyses</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {topStocks?.map((stock, index) => (
              <div key={stock.symbol} className="flex items-center gap-4">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted font-mono text-sm">
                  {index + 1}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold font-mono">{stock.symbol}</span>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      stock.sentiment === 'bullish' ? 'bg-primary/20 text-primary' :
                      stock.sentiment === 'bearish' ? 'bg-destructive/20 text-destructive' :
                      'bg-muted text-muted-foreground'
                    }`}>
                      {stock.sentiment}
                    </span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {stock.count} analyses • Avg Score: {stock.avgScore}
                  </div>
                </div>
                <div className="w-24">
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary"
                      style={{ width: `${stock.avgScore}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
