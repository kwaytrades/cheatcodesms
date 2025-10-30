import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Plus, Search, TrendingUp, Users, MessageSquare, Target, Play, Pause, Eye } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Progress } from "@/components/ui/progress";

export default function SalesCampaigns() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: campaigns, isLoading } = useQuery({
    queryKey: ['sales-campaigns'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_sales_campaigns')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  const filteredCampaigns = campaigns?.filter(campaign => {
    const matchesSearch = campaign.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || campaign.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: campaigns?.length || 0,
    active: campaigns?.filter(c => c.status === 'active').length || 0,
    totalContacts: campaigns?.reduce((sum, c) => sum + (c.contacts_engaged || 0), 0) || 0,
    avgConversion: campaigns?.length 
      ? (campaigns.reduce((sum, c) => sum + (c.conversions || 0), 0) / campaigns.reduce((sum, c) => sum + (c.messages_sent || 1), 0) * 100).toFixed(1)
      : 0,
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-success';
      case 'paused': return 'bg-warning';
      case 'completed': return 'bg-primary';
      default: return 'bg-muted';
    }
  };

  const getAgentIcon = (agentType: string) => {
    return agentType === 'sales_agent' ? <TrendingUp className="h-4 w-4" /> : <Users className="h-4 w-4" />;
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Sales Campaigns</h1>
          <p className="text-muted-foreground">Manage AI-powered outbound sales campaigns</p>
        </div>
        <Button onClick={() => navigate('/sales-campaigns/new')} size="lg">
          <Plus className="h-4 w-4 mr-2" />
          New Campaign
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Campaigns</CardDescription>
            <CardTitle className="text-3xl">{stats.total}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Active Campaigns</CardDescription>
            <CardTitle className="text-3xl text-success">{stats.active}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Contacts</CardDescription>
            <CardTitle className="text-3xl">{stats.totalContacts}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Avg Conversion</CardDescription>
            <CardTitle className="text-3xl">{stats.avgConversion}%</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search campaigns..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Tabs value={statusFilter} onValueChange={setStatusFilter}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="draft">Draft</TabsTrigger>
            <TabsTrigger value="active">Active</TabsTrigger>
            <TabsTrigger value="paused">Paused</TabsTrigger>
            <TabsTrigger value="completed">Completed</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Campaigns List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          <div className="col-span-full text-center py-12">Loading campaigns...</div>
        ) : filteredCampaigns?.length === 0 ? (
          <div className="col-span-full text-center py-12">
            <p className="text-muted-foreground">No campaigns found</p>
          </div>
        ) : (
          filteredCampaigns?.map((campaign) => (
            <Card key={campaign.id} className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate(`/sales-campaigns/${campaign.id}`)}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    {getAgentIcon(campaign.agent_type)}
                    <CardTitle className="text-lg">{campaign.name}</CardTitle>
                  </div>
                  <Badge className={getStatusColor(campaign.status)}>
                    {campaign.status}
                  </Badge>
                </div>
                <CardDescription className="line-clamp-2">{campaign.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Progress</span>
                    <span>{campaign.contacts_engaged}/{campaign.contact_count} contacts</span>
                  </div>
                  <Progress value={(campaign.contacts_engaged / campaign.contact_count) * 100} />
                </div>

                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div className="text-center">
                    <MessageSquare className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                    <div className="font-semibold">{campaign.messages_sent || 0}</div>
                    <div className="text-xs text-muted-foreground">Sent</div>
                  </div>
                  <div className="text-center">
                    <Users className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                    <div className="font-semibold">{campaign.responses_received || 0}</div>
                    <div className="text-xs text-muted-foreground">Replies</div>
                  </div>
                  <div className="text-center">
                    <Target className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                    <div className="font-semibold">{campaign.conversions || 0}</div>
                    <div className="text-xs text-muted-foreground">Conversions</div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1" onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/sales-campaigns/${campaign.id}`);
                  }}>
                    <Eye className="h-4 w-4 mr-2" />
                    View
                  </Button>
                  {campaign.status === 'active' && (
                    <Button variant="outline" size="sm" onClick={(e) => e.stopPropagation()}>
                      <Pause className="h-4 w-4" />
                    </Button>
                  )}
                  {campaign.status === 'draft' && (
                    <Button variant="outline" size="sm" onClick={(e) => e.stopPropagation()}>
                      <Play className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}