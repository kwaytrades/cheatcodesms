import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChevronLeft, Play, Pause, Edit, MessageSquare, Users, Target, TrendingUp, Copy, Square, Mail, Trash2, Clock, Send, AlertCircle } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDistanceToNow } from "date-fns";

export default function SalesCampaignDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [stopDialogOpen, setStopDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

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

  const { data: campaignMessages, isLoading: messagesLoading } = useQuery({
    queryKey: ['sales-campaign-messages', id],
    queryFn: async () => {
      const { data: campaignContacts, error: contactsError } = await supabase
        .from('ai_sales_campaign_contacts')
        .select('agent_id')
        .eq('campaign_id', id);
      
      if (contactsError) throw contactsError;
      
      const agentIds = campaignContacts?.map(cc => cc.agent_id).filter(Boolean) || [];
      
      if (agentIds.length === 0) return [];
      
      const { data: messages, error } = await supabase
        .from('scheduled_messages')
        .select(`
          id,
          contact_id,
          message_body,
          channel,
          status,
          scheduled_for,
          sent_at,
          created_at,
          contacts!inner(
            full_name,
            phone_number,
            email
          )
        `)
        .in('agent_id', agentIds)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return messages || [];
    },
    enabled: !!id,
  });

  const [messageStatusFilter, setMessageStatusFilter] = useState<string>('all');

  const pauseCampaignMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('pause-sales-campaign', {
        body: { campaign_id: id }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Campaign paused successfully');
      queryClient.invalidateQueries({ queryKey: ['sales-campaign', id] });
    },
    onError: (error: any) => {
      toast.error(`Failed to pause campaign: ${error.message}`);
    },
  });

  const resumeCampaignMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('resume-sales-campaign', {
        body: { campaign_id: id }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Campaign resumed successfully');
      queryClient.invalidateQueries({ queryKey: ['sales-campaign', id] });
    },
    onError: (error: any) => {
      toast.error(`Failed to resume campaign: ${error.message}`);
    },
  });

  const launchCampaignMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('activate-sales-campaign', {
        body: { campaign_id: id }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Campaign launched successfully');
      queryClient.invalidateQueries({ queryKey: ['sales-campaign', id] });
    },
    onError: (error: any) => {
      toast.error(`Failed to launch campaign: ${error.message}`);
    },
  });

  const stopCampaignMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('stop-sales-campaign', {
        body: { campaign_id: id }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Campaign stopped successfully');
      queryClient.invalidateQueries({ queryKey: ['sales-campaign', id] });
      setStopDialogOpen(false);
    },
    onError: (error: any) => {
      toast.error(`Failed to stop campaign: ${error.message}`);
    },
  });

  const duplicateCampaignMutation = useMutation({
    mutationFn: async () => {
      if (!campaign) throw new Error('Campaign not found');
      
      const { data: duplicate, error } = await supabase
        .from('ai_sales_campaigns')
        .insert({
          name: `${campaign.name} (Copy)`,
          description: campaign.description,
          agent_type: campaign.agent_type,
          audience_filter: campaign.audience_filter,
          campaign_config: campaign.campaign_config,
          campaign_strategy: campaign.campaign_strategy,
          status: 'draft'
        })
        .select()
        .single();

      if (error) throw error;

      // Populate contacts for the duplicated campaign
      if (campaign.audience_filter && Array.isArray(campaign.audience_filter)) {
        const filters = campaign.audience_filter as any[];
        const cleanedFilters = filters.map(({ id, ...rest }) => rest);
        
        const { data: contactsData, error: contactsError } = await supabase.functions.invoke('filter-contacts', {
          body: { filters: cleanedFilters, limit: 10000 }
        });

        if (!contactsError && contactsData?.contacts) {
          const contactsToInsert = contactsData.contacts.map((contact: any) => ({
            campaign_id: duplicate.id,
            contact_id: contact.id,
            status: 'pending'
          }));

          const { error: insertError } = await supabase
            .from('ai_sales_campaign_contacts')
            .insert(contactsToInsert);

          if (insertError) {
            console.error('Error inserting campaign contacts:', insertError);
          }

          // Update contact count
          await supabase
            .from('ai_sales_campaigns')
            .update({ contact_count: contactsData.total })
            .eq('id', duplicate.id);
        }
      }

      return duplicate;
    },
    onSuccess: (duplicate) => {
      toast.success('Campaign duplicated successfully');
      navigate(`/sales-campaigns/${duplicate.id}/edit`);
    },
    onError: (error: any) => {
      toast.error(`Failed to duplicate campaign: ${error.message}`);
    },
  });

  const deleteCampaignMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('ai_sales_campaigns')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Campaign deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['sales-campaigns'] });
      navigate('/sales-campaigns');
    },
    onError: (error: any) => {
      toast.error(`Failed to delete campaign: ${error.message}`);
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
            <Button 
              variant="outline" 
              onClick={() => duplicateCampaignMutation.mutate()}
              disabled={duplicateCampaignMutation.isPending}
            >
              <Copy className="h-4 w-4 mr-2" />
              Duplicate
            </Button>
            <Button 
              variant="outline" 
              onClick={() => navigate(`/sales-campaigns/${id}/edit`)}
              disabled={campaign.status === 'active'}
            >
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
            {campaign.status === 'active' ? (
              <>
                <Button 
                  onClick={() => pauseCampaignMutation.mutate()}
                  disabled={pauseCampaignMutation.isPending}
                >
                  <Pause className="h-4 w-4 mr-2" />
                  Pause
                </Button>
                <Button 
                  variant="destructive"
                  onClick={() => setStopDialogOpen(true)}
                >
                  <Square className="h-4 w-4 mr-2" />
                  Stop
                </Button>
              </>
            ) : campaign.status === 'paused' ? (
              <>
                <Button 
                  onClick={() => resumeCampaignMutation.mutate()}
                  disabled={resumeCampaignMutation.isPending}
                >
                  <Play className="h-4 w-4 mr-2" />
                  Resume
                </Button>
                <Button 
                  variant="destructive"
                  onClick={() => setStopDialogOpen(true)}
                >
                  <Square className="h-4 w-4 mr-2" />
                  Stop
                </Button>
              </>
            ) : campaign.status === 'draft' ? (
              <Button 
                onClick={() => launchCampaignMutation.mutate()}
                disabled={launchCampaignMutation.isPending}
              >
                <Play className="h-4 w-4 mr-2" />
                Launch
              </Button>
            ) : null}
            {(campaign.status === 'draft' || campaign.status === 'completed' || campaign.status === 'stopped') && (
              <Button 
                variant="destructive"
                onClick={() => setDeleteDialogOpen(true)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            )}
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
              <p className="text-sm text-muted-foreground">Channel</p>
              <div className="flex items-center gap-2 font-semibold">
                {campaign.channel === 'sms' ? (
                  <>
                    <MessageSquare className="h-4 w-4" />
                    <span>SMS</span>
                  </>
                ) : (
                  <>
                    <Mail className="h-4 w-4" />
                    <span>Email</span>
                  </>
                )}
              </div>
            </div>
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
                      <p className="text-sm text-muted-foreground">
                        {campaign.channel === 'sms' ? cc.contacts.phone_number : cc.contacts.email}
                      </p>
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
              <div className="flex items-center justify-between">
                <CardTitle>Message History</CardTitle>
                <Select value={messageStatusFilter} onValueChange={setMessageStatusFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Messages</SelectItem>
                    <SelectItem value="sent">Sent</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {messagesLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading messages...</div>
              ) : !campaignMessages || campaignMessages.length === 0 ? (
                <div className="text-center py-8">
                  <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No messages sent yet</p>
                </div>
              ) : (
                <ScrollArea className="h-[600px] pr-4">
                  <div className="space-y-4">
                    {campaignMessages
                      .filter(msg => messageStatusFilter === 'all' || msg.status === messageStatusFilter)
                      .map((message: any) => {
                        const getStatusVariant = (status: string) => {
                          switch (status) {
                            case 'sent': return 'default';
                            case 'pending': return 'secondary';
                            case 'failed': return 'destructive';
                            default: return 'outline';
                          }
                        };

                        const getStatusIcon = (status: string) => {
                          switch (status) {
                            case 'sent': return <Send className="h-3 w-3" />;
                            case 'pending': return <Clock className="h-3 w-3" />;
                            case 'failed': return <AlertCircle className="h-3 w-3" />;
                            default: return null;
                          }
                        };

                        const initials = message.contacts?.full_name
                          ?.split(' ')
                          .map((n: string) => n[0])
                          .join('')
                          .toUpperCase()
                          .slice(0, 2) || '??';

                        const destination = message.channel === 'sms' 
                          ? message.contacts?.phone_number 
                          : message.contacts?.email;

                        const truncatedMessage = message.message_body?.length > 200
                          ? message.message_body.substring(0, 200) + '...'
                          : message.message_body;

                        const timeAgo = message.sent_at 
                          ? formatDistanceToNow(new Date(message.sent_at), { addSuffix: true })
                          : formatDistanceToNow(new Date(message.created_at), { addSuffix: true });

                        return (
                          <div key={message.id} className="border rounded-lg p-4 space-y-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <Avatar className="h-10 w-10">
                                  <AvatarFallback className="text-sm">{initials}</AvatarFallback>
                                </Avatar>
                                <div>
                                  <p className="font-semibold">{message.contacts?.full_name || 'Unknown'}</p>
                                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    {message.channel === 'sms' ? (
                                      <MessageSquare className="h-3 w-3" />
                                    ) : (
                                      <Mail className="h-3 w-3" />
                                    )}
                                    <span>{destination || 'N/A'}</span>
                                  </div>
                                </div>
                              </div>
                              <div className="flex flex-col items-end gap-2">
                                <Badge variant={getStatusVariant(message.status)} className="flex items-center gap-1">
                                  {getStatusIcon(message.status)}
                                  {message.status}
                                </Badge>
                                <span className="text-xs text-muted-foreground">{timeAgo}</span>
                              </div>
                            </div>
                            <div className="text-sm text-muted-foreground bg-muted/50 rounded p-3">
                              {truncatedMessage}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </ScrollArea>
              )}
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

      <AlertDialog open={stopDialogOpen} onOpenChange={setStopDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Stop Campaign?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently stop the campaign and expire all associated agents. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => stopCampaignMutation.mutate()}
              disabled={stopCampaignMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Stop Campaign
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Campaign?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the campaign and all associated data including contacts, messages, and analytics. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => deleteCampaignMutation.mutate()}
              disabled={deleteCampaignMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Campaign
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}