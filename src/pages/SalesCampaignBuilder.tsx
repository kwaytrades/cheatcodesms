import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, TrendingUp, Users, Loader2 } from "lucide-react";
import { FilterBuilder } from "@/components/FilterBuilder";
import { AgentCampaignConfigEditor } from "@/components/AgentCampaignConfigEditor";
import { Badge } from "@/components/ui/badge";

export default function SalesCampaignBuilder() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [agentType, setAgentType] = useState<"sales_agent" | "lead_nurture">("sales_agent");
  const [filters, setFilters] = useState<any[]>([]);
  const [campaignConfig, setCampaignConfig] = useState<any>(null);

  // Get contact count based on filters
  const { data: contactCount, isLoading: isLoadingCount } = useQuery({
    queryKey: ['filtered-contacts-count', filters],
    queryFn: async () => {
      if (filters.length === 0) return 0;
      
      const { data, error } = await supabase.functions.invoke('filter-contacts', {
        body: { filters, limit: 10000 }
      });
      
      if (error) {
        console.error('Error fetching contacts:', error);
        return 0;
      }
      
      return data?.total || 0;
    },
    enabled: filters.length > 0 && step === 2,
  });

  const createCampaignMutation = useMutation({
    mutationFn: async ({ startImmediately }: { startImmediately: boolean }) => {
      const { data, error } = await supabase.functions.invoke('create-sales-campaign', {
        body: {
          name,
          description,
          agent_type: agentType,
          audience_filter: filters,
          campaign_config: campaignConfig,
          start_immediately: startImmediately,
        }
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success("Campaign created successfully!");
      navigate(`/sales-campaigns/${data.campaign.id}`);
    },
    onError: (error) => {
      toast.error(`Failed to create campaign: ${error.message}`);
    },
  });

  const canProceed = () => {
    switch (step) {
      case 1:
        return name.trim() !== "" && agentType;
      case 2:
        return filters.length > 0 && (contactCount || 0) > 0;
      case 3:
        return campaignConfig !== null;
      default:
        return false;
    }
  };

  const quickFilters = [
    { label: "🔥 Hot Leads", filters: [{ id: crypto.randomUUID(), field: "likelihood_category", operator: "equals", value: "hot" }] },
    { label: "🟡 Warm Leads", filters: [{ id: crypto.randomUUID(), field: "likelihood_category", operator: "equals", value: "warm" }] },
    { label: "👑 VIP Only", filters: [{ id: crypto.randomUUID(), field: "customer_tier", operator: "equals", value: "VIP" }] },
    { label: "💰 High Spenders", filters: [{ id: crypto.randomUUID(), field: "total_spent", operator: "greater_than", value: "1000" }] },
    { label: "📈 High Score", filters: [{ id: crypto.randomUUID(), field: "likelihood_to_buy_score", operator: "greater_than", value: "70" }] },
  ];

  return (
    <div className="container mx-auto p-6 max-w-5xl">
      <div className="mb-6">
        <Button variant="ghost" onClick={() => navigate('/sales-campaigns')}>
          <ChevronLeft className="h-4 w-4 mr-2" />
          Back to Campaigns
        </Button>
        <h1 className="text-3xl font-bold mt-4">Create Sales Campaign</h1>
        <p className="text-muted-foreground">Step {step} of 4</p>
      </div>

      {/* Step 1: Campaign Details */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Campaign Details</CardTitle>
            <CardDescription>Set up your campaign name and agent type</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">Campaign Name *</Label>
              <Input
                id="name"
                placeholder="e.g., Q4 VIP Sales Outreach"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                placeholder="Describe the goal of this campaign..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>Agent Type *</Label>
              <div className="grid grid-cols-2 gap-4">
                <Card 
                  className={`cursor-pointer hover:border-primary transition-colors ${agentType === 'sales_agent' ? 'border-primary bg-primary/5' : ''}`}
                  onClick={() => setAgentType('sales_agent')}
                >
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5" />
                      <CardTitle className="text-lg">Sales Agent</CardTitle>
                    </div>
                    <CardDescription>Direct sales focus, conversion-oriented messaging</CardDescription>
                  </CardHeader>
                </Card>

                <Card 
                  className={`cursor-pointer hover:border-primary transition-colors ${agentType === 'lead_nurture' ? 'border-primary bg-primary/5' : ''}`}
                  onClick={() => setAgentType('lead_nurture')}
                >
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      <CardTitle className="text-lg">Lead Nurture</CardTitle>
                    </div>
                    <CardDescription>Relationship building, educational content</CardDescription>
                  </CardHeader>
                </Card>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Select Audience */}
      {step === 2 && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Select Audience</CardTitle>
                  <CardDescription>Filter contacts for this campaign</CardDescription>
                </div>
                <Badge variant="secondary" className="text-lg">
                  {isLoadingCount ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    `${contactCount || 0} contacts`
                  )}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="mb-2">Quick Filters</Label>
                <div className="flex flex-wrap gap-2">
                  {quickFilters.map((qf, idx) => (
                    <Button
                      key={idx}
                      variant="outline"
                      size="sm"
                      onClick={() => setFilters(qf.filters)}
                    >
                      {qf.label}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t">
                <FilterBuilder
                  filters={filters}
                  onFiltersChange={setFilters}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Step 3: Configure Campaign */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>Campaign Configuration</CardTitle>
            <CardDescription>Set up messaging schedule and rules</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Campaign configuration will be managed through the agent type config. 
                For now, please configure your {agentType} agent settings in AI Agent Settings.
              </p>
              <Button onClick={() => {
                // Set a default config so we can proceed
                setCampaignConfig({
                  duration_days: 90,
                  outreach_schedule: [],
                  frequency_limits: {
                    max_per_day: 2,
                    max_per_week: 5,
                    min_hours_between: 12
                  }
                });
              }}>
                Use Default Configuration
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Review */}
      {step === 4 && (
        <Card>
          <CardHeader>
            <CardTitle>Review & Launch</CardTitle>
            <CardDescription>Confirm your campaign settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>Campaign Name</Label>
              <p className="text-lg font-semibold">{name}</p>
              {description && <p className="text-muted-foreground">{description}</p>}
            </div>

            <div className="space-y-2">
              <Label>Agent Type</Label>
              <Badge>{agentType === 'sales_agent' ? 'Sales Agent' : 'Lead Nurture'}</Badge>
            </div>

            <div className="space-y-2">
              <Label>Target Audience</Label>
              <p className="text-2xl font-bold">{contactCount || 0} contacts</p>
              <p className="text-sm text-muted-foreground">{filters.length} filters applied</p>
            </div>

            <div className="space-y-2">
              <Label>Campaign Duration</Label>
              <p>{campaignConfig?.duration_days || 90} days</p>
            </div>

            <div className="space-y-2">
              <Label>Scheduled Messages</Label>
              <p>{campaignConfig?.outreach_schedule?.length || 0} messages scheduled</p>
            </div>

            <div className="flex gap-4 pt-6">
              <Button
                size="lg"
                onClick={() => createCampaignMutation.mutate({ startImmediately: false })}
                disabled={createCampaignMutation.isPending}
              >
                {createCampaignMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : null}
                Save as Draft
              </Button>
              <Button
                size="lg"
                variant="default"
                onClick={() => createCampaignMutation.mutate({ startImmediately: true })}
                disabled={createCampaignMutation.isPending}
              >
                {createCampaignMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : null}
                Launch Campaign
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Navigation */}
      <div className="flex justify-between mt-6">
        <Button
          variant="outline"
          onClick={() => setStep(step - 1)}
          disabled={step === 1}
        >
          <ChevronLeft className="h-4 w-4 mr-2" />
          Previous
        </Button>
        <Button
          onClick={() => setStep(step + 1)}
          disabled={!canProceed() || step === 4}
        >
          Next
          <ChevronRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}