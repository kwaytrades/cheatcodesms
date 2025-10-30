import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChevronLeft, Play, Pause, Edit, MessageSquare, Users, Target, TrendingUp } from "lucide-react";

export default function SalesCampaignDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data: campaign, isLoading } = useQuery({
    queryKey: ['sales-campaign', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_sales_campaigns')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      return data;
    },
  });

  const { data: campaignContacts } = useQuery({
    queryKey: ['campaign-contacts', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_sales_campaign_contacts')
        .select('*, contacts(*)')
        .eq('campaign_id', id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return <div className="container mx-auto p-6">Loading campaign...</div>;
  }

  if (!campaign) {
    return <div className="container mx-auto p-6">Campaign not found</div>;
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-success';
      case 'paused': return 'bg-warning';
      case 'completed': return 'bg-primary';
      default: return 'bg-muted';
    }
  };

  const conversionRate = campaign.messages_sent > 0 
    ? ((campaign.conversions / campaign.messages_sent) * 100).toFixed(1)
    : '0';

  const responseRate = campaign.messages_sent > 0
    ? ((campaign.responses_received / campaign.messages_sent) * 100).toFixed(1)
    : '0';

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <Button variant="ghost" onClick={() => navigate('/sales-campaigns')}>
          <ChevronLeft className="h-4 w-4 mr-2" />
          Back to Campaigns
        </Button>
        
        <div className="flex justify-between items-start mt-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold">{campaign.name}</h1>
              <Badge className={getStatusColor(campaign.status)}>
                {campaign.status}
              </Badge>
            </div>
            {campaign.description && (
              <p className="text-muted-foreground mt-2">{campaign.description}</p>
            )}
          </div>
          
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate(`/sales-campaigns/${id}/edit`)}>
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
            {campaign.status === 'active' ? (
              <Button>
                <Pause className="h-4 w-4 mr-2" />
                Pause
              </Button>
            ) : campaign.status === 'draft' ? (
              <Button>
                <Play className="h-4 w-4 mr-2" />
                Launch
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <CardDescription>Contacts</CardDescription>
            </div>
            <CardTitle className="text-3xl">{campaign.contacts_engaged}/{campaign.contact_count}</CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              <CardDescription>Messages Sent</CardDescription>
            </div>
            <CardTitle className="text-3xl">{campaign.messages_sent || 0}</CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <CardDescription>Response Rate</CardDescription>
            </div>
            <CardTitle className="text-3xl">{responseRate}%</CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-muted-foreground" />
              <CardDescription>Conversions</CardDescription>
            </div>
            <CardTitle className="text-3xl">{campaign.conversions || 0}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="contacts">Contacts</TabsTrigger>
          <TabsTrigger value="messages">Messages</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Campaign Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Agent Type</p>
                <p className="font-semibold">{campaign.agent_type === 'sales_agent' ? 'Sales Agent' : 'Lead Nurture Agent'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Duration</p>
                <p className="font-semibold">
                  {typeof campaign.campaign_config === 'object' && campaign.campaign_config !== null && 'duration_days' in campaign.campaign_config
                    ? (campaign.campaign_config as any).duration_days
                    : 90} days
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Scheduled Messages</p>
                <p className="font-semibold">
                  {typeof campaign.campaign_config === 'object' && campaign.campaign_config !== null && 'outreach_schedule' in campaign.campaign_config
                    ? (campaign.campaign_config as any).outreach_schedule?.length || 0
                    : 0} messages
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Started</p>
                <p className="font-semibold">{campaign.start_date ? new Date(campaign.start_date).toLocaleDateString() : 'Not started'}</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contacts">
          <Card>
            <CardHeader>
              <CardTitle>Campaign Contacts ({campaignContacts?.length || 0})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {campaignContacts?.map((cc: any) => (
                  <div key={cc.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <p className="font-semibold">{cc.contacts.full_name}</p>
                      <p className="text-sm text-muted-foreground">{cc.contacts.email}</p>
                    </div>
                    <div className="text-right">
                      <Badge>{cc.status}</Badge>
                      <p className="text-sm text-muted-foreground mt-1">{cc.messages_received} messages</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="messages">
          <Card>
            <CardHeader>
              <CardTitle>Message History</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Message history will appear here</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics">
          <Card>
            <CardHeader>
              <CardTitle>Campaign Analytics</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Analytics charts will appear here</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}