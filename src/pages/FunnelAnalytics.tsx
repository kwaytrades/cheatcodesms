import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown, DollarSign, Users, Target, Eye } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from "recharts";

interface Funnel {
  id: string;
  name: string;
  description: string;
}

interface FunnelStep {
  id: string;
  step_number: number;
  step_name: string;
  step_type: string;
}

interface FunnelMetrics {
  totalVisitors: number;
  totalConversions: number;
  conversionRate: number;
  avgOrderValue: number;
  totalRevenue: number;
}

interface StepMetrics {
  stepName: string;
  visitors: number;
  conversions: number;
  dropOffRate: number;
  avgDuration: number;
}

export default function FunnelAnalytics() {
  const [funnels, setFunnels] = useState<Funnel[]>([]);
  const [selectedFunnelId, setSelectedFunnelId] = useState<string>("");
  const [steps, setSteps] = useState<FunnelStep[]>([]);
  const [metrics, setMetrics] = useState<FunnelMetrics | null>(null);
  const [stepMetrics, setStepMetrics] = useState<StepMetrics[]>([]);
  const [sourceData, setSourceData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFunnels();
  }, []);

  useEffect(() => {
    if (selectedFunnelId) {
      loadFunnelData();
    }
  }, [selectedFunnelId]);

  const loadFunnels = async () => {
    try {
      const { data, error } = await supabase
        .from('funnels')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setFunnels(data || []);
      if (data && data.length > 0) {
        setSelectedFunnelId(data[0].id);
      }
    } catch (error) {
      console.error('Error loading funnels:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadFunnelData = async () => {
    setLoading(true);
    try {
      // Load funnel steps
      const { data: stepsData, error: stepsError } = await supabase
        .from('funnel_steps')
        .select('*')
        .eq('funnel_id', selectedFunnelId)
        .order('step_number');

      if (stepsError) throw stepsError;
      setSteps(stepsData || []);

      // Load overall metrics
      const { data: visits, error: visitsError } = await supabase
        .from('funnel_visits')
        .select('*, funnel_conversions(*)')
        .eq('funnel_id', selectedFunnelId);

      if (visitsError) throw visitsError;

      const totalVisitors = visits?.length || 0;
      const completedVisits = visits?.filter(v => v.completed) || [];
      const totalConversions = completedVisits.length;
      const totalRevenue = completedVisits.reduce((sum, v) => sum + (Number(v.total_value) || 0), 0);
      const avgOrderValue = totalConversions > 0 ? totalRevenue / totalConversions : 0;
      const conversionRate = totalVisitors > 0 ? (totalConversions / totalVisitors) * 100 : 0;

      setMetrics({
        totalVisitors,
        totalConversions,
        conversionRate,
        avgOrderValue,
        totalRevenue,
      });

      // Calculate step metrics
      if (stepsData) {
        const stepMetricsData: StepMetrics[] = [];
        
        for (let i = 0; i < stepsData.length; i++) {
          const step = stepsData[i];
          
          const { data: events } = await supabase
            .from('funnel_step_events')
            .select('*, funnel_visits!inner(funnel_id)')
            .eq('step_id', step.id)
            .eq('funnel_visits.funnel_id', selectedFunnelId);

          const uniqueVisitors = new Set(events?.map(e => e.visit_id)).size;
      const avgDuration = events?.length > 0 
            ? events.reduce((sum, e) => sum + (e.duration_seconds || 0), 0) / events.length 
            : 0;

          const nextStepVisitors = i < stepsData.length - 1 
            ? await getStepVisitors(stepsData[i + 1].id, selectedFunnelId)
            : uniqueVisitors;

          const dropOffRate = uniqueVisitors > 0 
            ? ((uniqueVisitors - nextStepVisitors) / uniqueVisitors) * 100 
            : 0;

          stepMetricsData.push({
            stepName: step.step_name,
            visitors: uniqueVisitors,
            conversions: nextStepVisitors,
            dropOffRate,
            avgDuration: Math.round(avgDuration),
          });
        }

        setStepMetrics(stepMetricsData);
      }

      // Load source data
      const sourceBreakdown: { [key: string]: { visits: number; conversions: number; revenue: number } } = {};
      
      visits?.forEach(visit => {
        const source = visit.utm_source || visit.referrer || 'Direct';
        if (!sourceBreakdown[source]) {
          sourceBreakdown[source] = { visits: 0, conversions: 0, revenue: 0 };
        }
        sourceBreakdown[source].visits++;
        if (visit.completed) {
          sourceBreakdown[source].conversions++;
          sourceBreakdown[source].revenue += Number(visit.total_value) || 0;
        }
      });

      const sourceArray = Object.entries(sourceBreakdown).map(([name, data]) => ({
        name,
        visits: data.visits,
        conversions: data.conversions,
        revenue: data.revenue,
        conversionRate: (data.conversions / data.visits) * 100,
      }));

      setSourceData(sourceArray);

    } catch (error) {
      console.error('Error loading funnel data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStepVisitors = async (stepId: any, funnelId: string) => {
    const { data } = await supabase
      .from('funnel_step_events')
      .select('visit_id, funnel_visits!inner(funnel_id)')
      .eq('step_id', stepId)
      .eq('funnel_visits.funnel_id', funnelId);

    return new Set(data?.map(e => e.visit_id)).size;
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };

  const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

  if (loading && funnels.length === 0) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32" />)}
        </div>
      </div>
    );
  }

  if (funnels.length === 0) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>No Funnels Found</CardTitle>
            <CardDescription>
              Create your first funnel to start tracking conversions and analytics.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Funnel Analytics</h1>
          <p className="text-muted-foreground">Track visitor journeys and conversion metrics</p>
        </div>
        <Select value={selectedFunnelId} onValueChange={setSelectedFunnelId}>
          <SelectTrigger className="w-[300px]">
            <SelectValue placeholder="Select a funnel" />
          </SelectTrigger>
          <SelectContent>
            {funnels.map(funnel => (
              <SelectItem key={funnel.id} value={funnel.id}>
                {funnel.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32" />)}
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Visitors</CardTitle>
                <Eye className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics?.totalVisitors || 0}</div>
                <p className="text-xs text-muted-foreground">Unique sessions</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Conversions</CardTitle>
                <Target className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics?.totalConversions || 0}</div>
                <p className="text-xs text-muted-foreground">
                  {metrics?.conversionRate.toFixed(2)}% conversion rate
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg Order Value</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(metrics?.avgOrderValue || 0)}</div>
                <p className="text-xs text-muted-foreground">Per conversion</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(metrics?.totalRevenue || 0)}</div>
                <p className="text-xs text-muted-foreground">From this funnel</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Funnel Flow</CardTitle>
              <CardDescription>Visitor progression through funnel steps</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={stepMetrics}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="stepName" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="visitors" fill="hsl(var(--chart-1))" name="Visitors" />
                  <Bar dataKey="conversions" fill="hsl(var(--chart-2))" name="Continued" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Drop-off Analysis</CardTitle>
                <CardDescription>Where visitors exit the funnel</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {stepMetrics.map((step, index) => (
                    <div key={index} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{step.stepName}</span>
                        <span className="text-sm text-muted-foreground">
                          {step.dropOffRate.toFixed(1)}% drop-off
                        </span>
                      </div>
                      <div className="h-2 bg-secondary rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-destructive"
                          style={{ width: `${step.dropOffRate}%` }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {step.visitors} visitors · Avg {step.avgDuration}s
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Traffic Sources</CardTitle>
                <CardDescription>Conversions by source</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={sourceData}
                      dataKey="conversions"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={(entry) => `${entry.name}: ${entry.conversions}`}
                    >
                      {sourceData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Source Performance</CardTitle>
              <CardDescription>Detailed breakdown by traffic source</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Source</th>
                      <th className="text-right p-2">Visits</th>
                      <th className="text-right p-2">Conversions</th>
                      <th className="text-right p-2">Conv. Rate</th>
                      <th className="text-right p-2">Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sourceData.map((source, index) => (
                      <tr key={index} className="border-b">
                        <td className="p-2 font-medium">{source.name}</td>
                        <td className="text-right p-2">{source.visits}</td>
                        <td className="text-right p-2">{source.conversions}</td>
                        <td className="text-right p-2">{source.conversionRate.toFixed(1)}%</td>
                        <td className="text-right p-2">{formatCurrency(source.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
