import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Plus, Search, TrendingUp, Users, MessageSquare, Target, Play, Pause, Eye, MoreVertical, Copy, Square, Edit, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Progress } from "@/components/ui/progress";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

export default function SalesCampaigns() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { currentWorkspace } = useWorkspace();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [stopDialogOpen, setStopDialogOpen] = useState(false);
  const [campaignToStop, setCampaignToStop] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [campaignToDelete, setCampaignToDelete] = useState<string | null>(null);

  const { data: campaigns, isLoading } = useQuery({
    queryKey: ['sales-campaigns', currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace) return [];
      const { data, error } = await supabase
        .from('ai_sales_campaigns')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!currentWorkspace,
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

  const pauseCampaignMutation = useMutation({
    mutationFn: async (campaignId: string) => {
      const { data, error } = await supabase.functions.invoke('pause-sales-campaign', {
        body: { campaign_id: campaignId }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Campaign paused successfully');
      queryClient.invalidateQueries({ queryKey: ['sales-campaigns'] });
    },
    onError: (error: any) => {
      toast.error(`Failed to pause campaign: ${error.message}`);
    },
  });

  const resumeCampaignMutation = useMutation({
    mutationFn: async (campaignId: string) => {
      const { data, error } = await supabase.functions.invoke('resume-sales-campaign', {
        body: { campaign_id: campaignId }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Campaign resumed successfully');
      queryClient.invalidateQueries({ queryKey: ['sales-campaigns'] });
    },
    onError: (error: any) => {
      toast.error(`Failed to resume campaign: ${error.message}`);
    },
  });

  const launchCampaignMutation = useMutation({
    mutationFn: async (campaignId: string) => {
      const { data, error } = await supabase.functions.invoke('activate-sales-campaign', {
        body: { campaign_id: campaignId }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Campaign launched successfully');
      queryClient.invalidateQueries({ queryKey: ['sales-campaigns'] });
    },
    onError: (error: any) => {
      toast.error(`Failed to launch campaign: ${error.message}`);
    },
  });

  const stopCampaignMutation = useMutation({
    mutationFn: async (campaignId: string) => {
      const { data, error } = await supabase.functions.invoke('stop-sales-campaign', {
        body: { campaign_id: campaignId }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Campaign stopped successfully');
      queryClient.invalidateQueries({ queryKey: ['sales-campaigns'] });
      setStopDialogOpen(false);
      setCampaignToStop(null);
    },
    onError: (error: any) => {
      toast.error(`Failed to stop campaign: ${error.message}`);
    },
  });

  const duplicateCampaignMutation = useMutation({
    mutationFn: async (campaignId: string) => {
      // Fetch original campaign
      const { data: original, error: fetchError } = await supabase
        .from('ai_sales_campaigns')
        .select('*')
        .eq('id', campaignId)
        .single();
      
      if (fetchError) throw fetchError;

      // Create duplicate
      const { data: duplicate, error: createError } = await supabase
        .from('ai_sales_campaigns')
        .insert({
          name: `${original.name} (Copy)`,
          description: original.description,
          agent_type: original.agent_type,
          audience_filter: original.audience_filter,
          campaign_config: original.campaign_config,
          campaign_strategy: original.campaign_strategy,
          status: 'draft',
          workspace_id: original.workspace_id,
          channel: original.channel
        })
        .select()
        .single();

      if (createError) throw createError;

      // Populate contacts for the duplicated campaign
      if (original.audience_filter && Array.isArray(original.audience_filter)) {
        const filters = original.audience_filter as any[];
        const cleanedFilters = filters.map(({ id, ...rest }) => rest);
        
        const { data: contactsData, error: contactsError } = await supabase.functions.invoke('filter-contacts', {
          body: { filters: cleanedFilters, limit: 10000 }
        });

        if (!contactsError && contactsData?.contacts) {
          const contactsToInsert = contactsData.contacts.map((contact: any) => ({
            campaign_id: duplicate.id,
            contact_id: contact.id,
            status: 'pending',
            workspace_id: original.workspace_id
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
      queryClient.invalidateQueries({ queryKey: ['sales-campaigns'] });
      navigate(`/sales-campaigns/${duplicate.id}/edit`);
    },
    onError: (error: any) => {
      toast.error(`Failed to duplicate campaign: ${error.message}`);
    },
  });

  const deleteCampaignMutation = useMutation({
    mutationFn: async (campaignId: string) => {
      const { error } = await supabase
        .from('ai_sales_campaigns')
        .delete()
        .eq('id', campaignId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Campaign deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['sales-campaigns'] });
      setDeleteDialogOpen(false);
      setCampaignToDelete(null);
    },
    onError: (error: any) => {
      toast.error(`Failed to delete campaign: ${error.message}`);
    },
  });

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
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button variant="outline" size="sm">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/sales-campaigns/${campaign.id}/edit`);
                      }} disabled={campaign.status === 'active'}>
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      {campaign.status === 'draft' && (
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation();
                          launchCampaignMutation.mutate(campaign.id);
                        }} disabled={launchCampaignMutation.isPending}>
                          <Play className="h-4 w-4 mr-2" />
                          Launch
                        </DropdownMenuItem>
                      )}
                      {campaign.status === 'active' && (
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation();
                          pauseCampaignMutation.mutate(campaign.id);
                        }} disabled={pauseCampaignMutation.isPending}>
                          <Pause className="h-4 w-4 mr-2" />
                          Pause
                        </DropdownMenuItem>
                      )}
                      {campaign.status === 'paused' && (
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation();
                          resumeCampaignMutation.mutate(campaign.id);
                        }} disabled={resumeCampaignMutation.isPending}>
                          <Play className="h-4 w-4 mr-2" />
                          Resume
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={(e) => {
                        e.stopPropagation();
                        duplicateCampaignMutation.mutate(campaign.id);
                      }} disabled={duplicateCampaignMutation.isPending}>
                        <Copy className="h-4 w-4 mr-2" />
                        Duplicate
                      </DropdownMenuItem>
                      {(campaign.status === 'active' || campaign.status === 'paused') && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            onClick={(e) => {
                              e.stopPropagation();
                              setCampaignToStop(campaign.id);
                              setStopDialogOpen(true);
                            }}
                            className="text-destructive"
                          >
                            <Square className="h-4 w-4 mr-2" />
                            Stop Campaign
                          </DropdownMenuItem>
                        </>
                      )}
                      {(campaign.status === 'draft' || campaign.status === 'completed' || campaign.status === 'stopped') && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            onClick={(e) => {
                              e.stopPropagation();
                              setCampaignToDelete(campaign.id);
                              setDeleteDialogOpen(true);
                            }}
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete Campaign
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

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
              onClick={() => campaignToStop && stopCampaignMutation.mutate(campaignToStop)}
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
              onClick={() => campaignToDelete && deleteCampaignMutation.mutate(campaignToDelete)}
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