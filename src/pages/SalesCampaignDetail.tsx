import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChevronLeft, Play, Pause, Edit, MessageSquare, Users, Target, TrendingUp, Copy, Square, Mail, Trash2, Clock, Send, AlertCircle, ArrowDownLeft, ArrowUpRight, Check, X } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDistanceToNow, format } from "date-fns";
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

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
      // Get campaign start date and contacts
      const { data: campaignData } = await supabase
        .from('ai_sales_campaigns')
        .select('start_date, created_at')
        .eq('id', id)
        .single();
      
      const campaignStartDate = campaignData?.start_date || campaignData?.created_at;
      
      // Get all agent IDs and contact IDs for this campaign
      const { data: campaignContacts, error: contactsError } = await supabase
        .from('ai_sales_campaign_contacts')
        .select('agent_id, contact_id')
        .eq('campaign_id', id);
      
      if (contactsError) throw contactsError;
      
      const agentIds = campaignContacts?.map(cc => cc.agent_id).filter(Boolean) || [];
      const contactIds = campaignContacts?.map(cc => cc.contact_id).filter(Boolean) || [];
      
      if (agentIds.length === 0) return [];
      
      // Fetch outbound messages (campaign messages) sent by agents
      // Only show messages with proper campaign_id tracking (filters out old/misattributed messages)
      const { data: outboundMessages, error: outboundError } = await supabase
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
      .eq('campaign_id', id)
      .not('campaign_id', 'is', null);
      
      if (outboundError) throw outboundError;
      
      // Fetch inbound messages (user replies) after campaign started
      let inboundQuery = supabase
        .from('messages')
        .select(`
          id,
          body,
          created_at,
          conversation_id,
          conversations!inner(
            contact_id,
            phone_number,
            contacts(
              full_name,
              email
            )
          )
        `)
        .eq('direction', 'inbound')
        .in('conversations.contact_id', contactIds);
      
      // Only include messages after campaign started
      if (campaignStartDate) {
        inboundQuery = inboundQuery.gte('created_at', campaignStartDate);
      }
      
      const { data: inboundMessages, error: inboundError } = await inboundQuery;
      if (inboundError) throw inboundError;
      
      // Normalize and combine messages
      const normalizedOutbound = (outboundMessages || []).map(msg => ({
        id: msg.id,
        type: 'outbound' as const,
        contactName: msg.contacts.full_name,
        destination: msg.contacts.phone_number || msg.contacts.email,
        body: msg.message_body,
        channel: msg.channel,
        status: msg.status,
        timestamp: msg.sent_at || msg.created_at,
        createdAt: msg.created_at
      }));
      
      const normalizedInbound = (inboundMessages || []).map(msg => ({
        id: msg.id,
        type: 'inbound' as const,
        contactName: msg.conversations.contacts?.full_name || 'Unknown',
        destination: msg.conversations.phone_number,
        body: msg.body,
        channel: 'sms' as const,
        status: 'received' as const,
        timestamp: msg.created_at,
        createdAt: msg.created_at
      }));
      
      // Combine messages
      const normalizedMessages = [...normalizedOutbound, ...normalizedInbound];
      
      // Group by contact
      const groupedByContact = normalizedMessages.reduce((acc, msg) => {
        const key = msg.contactName;
        if (!acc[key]) {
          acc[key] = {
            contactName: msg.contactName,
            destination: msg.destination,
            messages: []
          };
        }
        acc[key].messages.push(msg);
        return acc;
      }, {} as Record<string, { contactName: string; destination: string; messages: typeof normalizedMessages }>);

      // Sort messages within each thread chronologically (oldest first for conversation flow)
      Object.values(groupedByContact).forEach(thread => {
        thread.messages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      });

      // Sort threads by most recent message (most recent thread first)
      const sortedThreads = Object.values(groupedByContact).sort((a, b) => {
        const aLatest = a.messages[a.messages.length - 1].timestamp;
        const bLatest = b.messages[b.messages.length - 1].timestamp;
        return new Date(bLatest).getTime() - new Date(aLatest).getTime();
      });

      return sortedThreads;
    },
    enabled: !!id,
  });

  const { data: responseStats } = useQuery({
    queryKey: ['campaign-response-stats', id],
    queryFn: async () => {
      const { data: campaignContacts } = await supabase
        .from('ai_sales_campaign_contacts')
        .select('contact_id, responded')
        .eq('campaign_id', id);
      
      if (!campaignContacts || campaignContacts.length === 0) {
        return { totalContacts: 0, respondedContacts: 0, responseRate: 0 };
      }
      
      const totalContacts = campaignContacts.length;
      const respondedContacts = campaignContacts.filter(cc => cc.responded).length;
      const responseRate = totalContacts > 0 
        ? Math.round((respondedContacts / totalContacts) * 100 * 10) / 10
        : 0;
      
      return { totalContacts, respondedContacts, responseRate };
    },
    enabled: !!id,
  });

  // Retroactive response detection - check for messages sent after campaign started
  useEffect(() => {
    if (!campaign?.start_date || !id) return;
    
    const checkRetrospectiveResponses = async () => {
      const { data: contacts } = await supabase
        .from('ai_sales_campaign_contacts')
        .select('id, contact_id, responded')
        .eq('campaign_id', id)
        .eq('responded', false);
      
      if (!contacts || contacts.length === 0) return;
      
      let updated = false;
      
      for (const contact of contacts) {
        const { data: inboundMessages } = await supabase
          .from('messages')
          .select('id, conversation_id, conversations!inner(contact_id)')
          .eq('direction', 'inbound')
          .eq('conversations.contact_id', contact.contact_id)
          .gte('created_at', campaign.start_date)
          .limit(1);
        
        if (inboundMessages && inboundMessages.length > 0) {
          await supabase
            .from('ai_sales_campaign_contacts')
            .update({ responded: true })
            .eq('id', contact.id);
          
          updated = true;
          console.log(`✅ Retroactively marked contact ${contact.contact_id} as responded`);
        }
      }
      
      if (updated) {
        const { data: updatedContacts } = await supabase
          .from('ai_sales_campaign_contacts')
          .select('responded')
          .eq('campaign_id', id);
        
        const responseCount = updatedContacts?.filter(c => c.responded).length || 0;
        
        await supabase
          .from('ai_sales_campaigns')
          .update({ responses_received: responseCount })
          .eq('id', id);
        
        queryClient.invalidateQueries({ queryKey: ['campaign-response-stats', id] });
      }
    };
    
    checkRetrospectiveResponses();
  }, [campaign?.start_date, id, queryClient]);

  // Real-time response tracking: Listen for new inbound messages
  useEffect(() => {
    if (!campaign || campaign.status !== 'active' || !campaignContacts) return;

    const contactIds = campaignContacts.map((c: any) => c.contact_id);
    
    const channel = supabase
      .channel('campaign-responses')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: 'direction=eq.inbound'
        },
        async (payload: any) => {
          const message = payload.new;
          
          // Get conversation to check contact_id
          const { data: conversation } = await supabase
            .from('conversations')
            .select('contact_id')
            .eq('id', message.conversation_id)
            .single();
          
          // Check if this message is from a campaign contact
          if (conversation && contactIds.includes(conversation.contact_id)) {
            console.log('Real-time: Inbound message detected for campaign contact:', conversation.contact_id);
            
            // Update the contact's responded status
            const { error } = await supabase
              .from('ai_sales_campaign_contacts')
              .update({ responded: true })
              .eq('campaign_id', campaign.id)
              .eq('contact_id', conversation.contact_id)
              .eq('responded', false);

            if (!error) {
              console.log('Real-time: Contact marked as responded');
              queryClient.invalidateQueries({ queryKey: ['sales-campaign', campaign.id] });
              queryClient.invalidateQueries({ queryKey: ['campaign-contacts', campaign.id] });
              queryClient.invalidateQueries({ queryKey: ['campaign-response-stats', campaign.id] });
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [campaign?.id, campaign?.status, campaignContacts, queryClient]);

  const [messageStatusFilter, setMessageStatusFilter] = useState<string>('all');
  const [messageDirectionFilter, setMessageDirectionFilter] = useState<'all' | 'outbound' | 'inbound'>('all');

  const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

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
      // Prevent re-activation if campaign is already active
      if (campaign?.status === 'active') {
        throw new Error('Campaign is already active');
      }

      const { data, error } = await supabase.functions.invoke('activate-sales-campaign', {
        body: { campaign_id: id }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Campaign activated! ${data?.activated_count || 0} contacts engaged.`);
      queryClient.invalidateQueries({ queryKey: ['sales-campaign', id] });
      queryClient.invalidateQueries({ queryKey: ['campaign-contacts', id] });
      queryClient.invalidateQueries({ queryKey: ['sales-campaign-messages', id] });
      queryClient.invalidateQueries({ queryKey: ['campaign-response-stats', id] });
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

  // Calculate analytics data for charts (must be before early returns)
  const analyticsData = useMemo(() => {
    if (!campaignMessages || campaignMessages.length === 0) return [];

    const dataMap = new Map<string, { messages: number; responses: number }>();
    
    campaignMessages.forEach((thread: any) => {
      thread.messages.forEach((msg: any) => {
        const date = format(new Date(msg.timestamp), 'MMM dd');
        const existing = dataMap.get(date) || { messages: 0, responses: 0 };
        
        if (msg.type === 'outbound') {
          existing.messages++;
        } else if (msg.type === 'inbound') {
          existing.responses++;
        }
        
        dataMap.set(date, existing);
      });
    });

    return Array.from(dataMap.entries())
      .map(([date, data]) => ({
        date,
        ...data,
        responseRate: data.messages > 0 ? Math.round((data.responses / data.messages) * 100) : 0
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [campaignMessages]);

  const funnelData = useMemo(() => {
    const totalContacts = campaignContacts?.length || 0;
    const messagedContacts = campaignContacts?.filter((c: any) => c.messages_received > 0).length || 0;
    const respondedContacts = campaignContacts?.filter((c: any) => c.responded).length || 0;
    const convertedContacts = campaignContacts?.filter((c: any) => c.converted).length || 0;

    return [
      { stage: 'Total Contacts', count: totalContacts },
      { stage: 'Messaged', count: messagedContacts },
      { stage: 'Responded', count: respondedContacts },
      { stage: 'Converted', count: convertedContacts }
    ];
  }, [campaignContacts]);

  const statusDistribution = useMemo(() => {
    if (!campaignContacts || campaignContacts.length === 0) return [];

    const statusCounts = campaignContacts.reduce((acc: any, contact: any) => {
      acc[contact.status] = (acc[contact.status] || 0) + 1;
      return acc;
    }, {});

    return Object.entries(statusCounts).map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      value
    }));
  }, [campaignContacts]);

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
                {launchCampaignMutation.isPending ? 'Launching...' : 'Launch'}
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
            <CardTitle className="text-3xl">{responseStats?.responseRate.toFixed(1) || 0}%</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              {responseStats?.respondedContacts || 0} of {responseStats?.totalContacts || 0} replied
            </p>
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
                <div className="flex items-center gap-3">
                  <Select value={messageStatusFilter} onValueChange={setMessageStatusFilter}>
                    <SelectTrigger className="w-[160px]">
                      <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="sent">Sent</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="failed">Failed</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  <Select 
                    value={messageDirectionFilter} 
                    onValueChange={(v) => setMessageDirectionFilter(v as 'all' | 'outbound' | 'inbound')}
                  >
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Filter by type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Messages</SelectItem>
                      <SelectItem value="outbound">Campaign Messages</SelectItem>
                      <SelectItem value="inbound">Contact Replies</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {campaignMessages && campaignMessages.length > 0 && (() => {
                const filteredThreads = campaignMessages.filter(thread => {
                  const hasMatchingMessages = thread.messages.some((msg: any) =>
                    (messageStatusFilter === 'all' || msg.status === messageStatusFilter) &&
                    (messageDirectionFilter === 'all' || msg.type === messageDirectionFilter)
                  );
                  return hasMatchingMessages;
                });
                const totalMessages = filteredThreads.reduce((sum, thread) => sum + thread.messages.length, 0);
                
                return (
                  <div className="text-sm text-muted-foreground mt-2">
                    Showing {totalMessages} messages in {filteredThreads.length} conversations
                  </div>
                );
              })()}
            </CardHeader>
            <CardContent>
              {messagesLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading messages...</div>
              ) : !campaignMessages || campaignMessages.length === 0 ? (
                <div className="text-center py-8">
                  <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No messages sent yet</p>
                </div>
              ) : (() => {
                const getStatusVariant = (status: string) => {
                  switch (status) {
                    case 'sent': return 'default';
                    case 'pending': return 'secondary';
                    case 'failed': return 'destructive';
                    default: return 'outline';
                  }
                };

                const filteredThreads = campaignMessages?.filter(thread => {
                  const hasMatchingMessages = thread.messages.some((msg: any) =>
                    (messageStatusFilter === 'all' || msg.status === messageStatusFilter) &&
                    (messageDirectionFilter === 'all' || msg.type === messageDirectionFilter)
                  );
                  return hasMatchingMessages;
                }).map(thread => ({
                  ...thread,
                  messages: thread.messages.filter((msg: any) =>
                    (messageStatusFilter === 'all' || msg.status === messageStatusFilter) &&
                    (messageDirectionFilter === 'all' || msg.type === messageDirectionFilter)
                  )
                })) || [];

                return (
                  <ScrollArea className="h-[600px] pr-4">
                    <div className="space-y-6">
                      {filteredThreads.map((thread: any) => (
                        <div key={thread.contactName} className="space-y-2">
                          {/* Thread Header */}
                          <div className="flex items-center gap-3 sticky top-0 bg-background/95 backdrop-blur py-2 px-3 rounded-lg border">
                            <Avatar className="h-10 w-10">
                              <AvatarFallback>
                                {thread.contactName?.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                              <p className="font-semibold">{thread.contactName}</p>
                              <p className="text-xs text-muted-foreground">{thread.destination}</p>
                            </div>
                            <Badge variant="outline">{thread.messages.length} messages</Badge>
                          </div>

                          {/* Messages in Thread */}
                          <div className="pl-4 space-y-2">
                            {thread.messages.map((msg: any) => (
                              <div
                                key={msg.id}
                                className={`border rounded-lg p-3 space-y-2 ${
                                  msg.type === 'inbound'
                                    ? 'bg-primary/5 border-primary/20 ml-8'
                                    : 'bg-card mr-8'
                                }`}
                              >
                                {/* Message Header */}
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    {msg.type === 'inbound' ? (
                                      <ArrowDownLeft className="h-3 w-3 text-primary" />
                                    ) : (
                                      <ArrowUpRight className="h-3 w-3 text-muted-foreground" />
                                    )}
                                    <span className="text-xs font-medium">
                                      {msg.type === 'inbound' ? 'Reply' : 'Campaign'}
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-2">
                                    {msg.type === 'outbound' && (
                                      <Badge variant={getStatusVariant(msg.status)} className="flex items-center gap-1">
                                        {msg.status === 'sent' && <Check className="h-3 w-3" />}
                                        {msg.status === 'failed' && <X className="h-3 w-3" />}
                                        {msg.status === 'pending' && <Clock className="h-3 w-3" />}
                                        {msg.status}
                                      </Badge>
                                    )}
                                    <Badge variant="outline" className="flex items-center gap-1">
                                      {msg.channel === 'sms' ? (
                                        <MessageSquare className="h-3 w-3" />
                                      ) : (
                                        <Mail className="h-3 w-3" />
                                      )}
                                      {msg.channel}
                                    </Badge>
                                    <span className="text-xs text-muted-foreground">
                                      {formatDistanceToNow(new Date(msg.timestamp), { addSuffix: true })}
                                    </span>
                                  </div>
                                </div>

                                {/* Message Body */}
                                <div className={`text-sm bg-muted/50 rounded p-2 whitespace-pre-wrap ${
                                  msg.type === 'inbound'
                                    ? 'text-foreground'
                                    : 'text-muted-foreground'
                                }`}>
                                  {msg.body}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                      
                      {filteredThreads.length === 0 && (
                        <div className="text-center py-8 text-muted-foreground">
                          No messages found matching the selected filters.
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                );
              })()}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Messages & Responses Over Time</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  {analyticsData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={analyticsData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="date" className="text-xs" />
                        <YAxis className="text-xs" />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--background))', 
                            border: '1px solid hsl(var(--border))' 
                          }}
                        />
                        <Legend />
                        <Line type="monotone" dataKey="messages" stroke="hsl(var(--primary))" name="Messages Sent" strokeWidth={2} />
                        <Line type="monotone" dataKey="responses" stroke="hsl(var(--chart-2))" name="Responses" strokeWidth={2} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      No data available yet
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Conversion Funnel</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  {funnelData.some(d => d.count > 0) ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={funnelData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis type="number" className="text-xs" />
                        <YAxis dataKey="stage" type="category" width={120} className="text-xs" />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--background))', 
                            border: '1px solid hsl(var(--border))' 
                          }}
                        />
                        <Bar dataKey="count" fill="hsl(var(--primary))" />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      No data available yet
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Response Rate by Day</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  {analyticsData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={analyticsData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="date" className="text-xs" />
                        <YAxis className="text-xs" />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--background))', 
                            border: '1px solid hsl(var(--border))' 
                          }}
                        />
                        <Legend />
                        <Bar dataKey="responseRate" fill="hsl(var(--chart-3))" name="Response Rate %" />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      No data available yet
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Contact Status Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  {statusDistribution.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={statusDistribution}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                          outerRadius={80}
                          fill="hsl(var(--primary))"
                          dataKey="value"
                        >
                          {statusDistribution.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--background))', 
                            border: '1px solid hsl(var(--border))' 
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      No data available yet
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
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