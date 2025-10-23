import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Bot, Plus, Filter, Download, BarChart3, Settings, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AgentStatusBadge } from "@/components/agents/AgentStatusBadge";
import { AgentTypeIcon } from "@/components/agents/AgentTypeIcon";
import { AssignAgentDialog } from "@/components/agents/AssignAgentDialog";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { FlaskConical } from "lucide-react";
import { formatDaysRemaining } from "@/lib/agent-utils";
import { formatDistanceToNow } from "date-fns";

export default function AIAgents() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const { toast } = useToast();

  const { data: agents, isLoading } = useQuery({
    queryKey: ["product-agents", statusFilter, typeFilter],
    queryFn: async () => {
      let query = supabase
        .from("product_agents")
        .select(`
          *,
          contacts!inner(
            id,
            full_name,
            email,
            phone_number,
            customer_tier
          )
        `);

      // Filter out archived agents by default, unless specifically viewing archived
      if (statusFilter === "archived") {
        query = query.eq("status", "archived");
      } else if (statusFilter === "all") {
        query = query.neq("status", "archived");
      } else if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      } else {
        query = query.neq("status", "archived");
      }

      if (typeFilter !== "all") {
        query = query.eq("product_type", typeFilter);
      }

      query = query.order("assigned_date", { ascending: false });

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const { data: stats } = useQuery({
    queryKey: ["agent-stats"],
    queryFn: async () => {
      const { data: activeAgents } = await supabase
        .from("product_agents")
        .select("id")
        .eq("status", "active");

      const { data: expiringSoon } = await supabase
        .from("product_agents")
        .select("id")
        .eq("status", "active")
        .gte("expiration_date", new Date().toISOString())
        .lte("expiration_date", new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString());

      const { data: metrics } = await supabase
        .from("agent_performance_metrics")
        .select("reply_rate, conversion_rate")
        .gte("period_start", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .single();

      return {
        totalActive: activeAgents?.length || 0,
        expiringSoon: expiringSoon?.length || 0,
        replyRate: metrics?.reply_rate || 0,
        conversionRate: metrics?.conversion_rate || 0,
      };
    },
  });

  const filteredAgents = agents?.filter((agent) =>
    agent.contacts.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    agent.contacts.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );


  const handleExtendAgent = async (agentId: string) => {
    const newExpiration = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const { error } = await supabase
      .from("product_agents")
      .update({ expiration_date: newExpiration })
      .eq("id", agentId);

    if (error) {
      toast({ title: "Error", description: "Failed to extend agent", variant: "destructive" });
    } else {
      toast({ title: "Success", description: "Agent extended by 30 days" });
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Bot className="w-8 h-8" />
            AI Agents
          </h1>
          <p className="text-muted-foreground">Manage product concierge agents and view performance</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/agents/test')}>
            <FlaskConical className="w-4 h-4 mr-2" />
            Test Agents
          </Button>
          <Button onClick={() => setShowAssignDialog(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Assign Agent
          </Button>
        </div>
      </div>

      <Tabs value="dashboard" className="w-full">
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
          <TabsTrigger value="test" onClick={() => navigate("/agents/test")}>
            <FlaskConical className="w-4 h-4 mr-2" />
            Testing Lab
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Active Agents</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalActive || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Expiring This Week</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.expiringSoon || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Reply Rate (7d)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.replyRate?.toFixed(1) || 0}%</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Conversion Rate (30d)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.conversionRate?.toFixed(1) || 0}%</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Active Agents</CardTitle>
            <div className="flex gap-2">
              <Input
                placeholder="Search customers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-64"
              />
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                  <SelectItem value="converted">Converted</SelectItem>
                  <SelectItem value="archived">Archived (60d+ inactive)</SelectItem>
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="webinar">Webinar</SelectItem>
                  <SelectItem value="textbook">Textbook</SelectItem>
                  <SelectItem value="flashcards">Flashcards</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Agent Type</TableHead>
                <TableHead>Days Remaining</TableHead>
                <TableHead>Last Activity</TableHead>
                <TableHead>Messages</TableHead>
                <TableHead>Replies</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center">Loading...</TableCell>
                </TableRow>
              ) : filteredAgents?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center">No agents found</TableCell>
                </TableRow>
              ) : (
                filteredAgents?.map((agent) => (
                  <TableRow key={agent.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{agent.contacts.full_name}</div>
                        <div className="text-sm text-muted-foreground">{agent.contacts.email}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <AgentTypeIcon type={agent.product_type} />
                        <span className="capitalize">{agent.product_type.replace(/_/g, ' ')}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <span className="font-medium">
                          {formatDaysRemaining(agent.expiration_date, agent.product_type)}
                        </span>
                        {agent.product_type !== 'customer_service' && <span className="text-muted-foreground">days</span>}
                      </div>
                    </TableCell>
                    <TableCell>
                      {agent.last_engagement_at ? (
                        <div className="text-sm">
                          {formatDistanceToNow(new Date(agent.last_engagement_at), { addSuffix: true })}
                        </div>
                      ) : (
                        <div className="text-sm text-muted-foreground">Never</div>
                      )}
                    </TableCell>
                    <TableCell>{agent.messages_sent}</TableCell>
                    <TableCell>{agent.replies_received}</TableCell>
                    <TableCell>
                      <AgentStatusBadge status={agent.status} />
                    </TableCell>
                    <TableCell>
                      {agent.product_type !== 'customer_service' && agent.status === 'active' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleExtendAgent(agent.id)}
                        >
                          Extend
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AssignAgentDialog open={showAssignDialog} onOpenChange={setShowAssignDialog} />
    </div>
  );
}
