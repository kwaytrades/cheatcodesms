import { useState, useEffect } from "react";
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
import { ChevronLeft, ChevronRight, TrendingUp, Users, Loader2, MessageSquare, Mail } from "lucide-react";
import { FilterBuilder } from "@/components/FilterBuilder";
import { CampaignStrategyEditor } from "@/components/CampaignStrategyEditor";
import { Badge } from "@/components/ui/badge";

export default function SalesCampaignBuilder() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [agentType] = useState<"sales_agent">("sales_agent"); // Sales campaigns only use sales_agent
  const [channel, setChannel] = useState<"sms" | "email">("sms");
  const [filters, setFilters] = useState<any[]>([]);
  const [campaignStrategy, setCampaignStrategy] = useState<{
    primary_objective: string;
    products: string[];
    value_propositions: string[];
    pricing: Record<string, any>;
    discount_strategy: {
      approach: string;
      amount?: string;
      expiration?: string;
    };
    sales_intensity: number;
    objection_handling: string;
    campaign_context: string;
    key_talking_points: string[];
    avoid_topics: string[];
    competitive_positioning: string;
  }>({
    primary_objective: "close_sales",
    products: [],
    value_propositions: [],
    pricing: {},
    discount_strategy: {
      approach: "no_discounts",
    },
    sales_intensity: 5,
    objection_handling: "address_with_education",
    campaign_context: "",
    key_talking_points: [],
    avoid_topics: [],
    competitive_positioning: "",
  });

  // Get contact count based on filters
  const { data: contactCount, isLoading: isLoadingCount, refetch } = useQuery({
    queryKey: ['filtered-contacts-count', filters],
    queryFn: async () => {
      if (filters.length === 0) return 0;
      
      console.log('Fetching contacts with filters:', filters);
      
      // Clean filters by removing the 'id' field before sending
      const cleanedFilters = filters.map(({ id, ...rest }) => rest);
      
      const { data, error } = await supabase.functions.invoke('filter-contacts', {
        body: { filters: cleanedFilters, limit: 10000 }
      });
      
      if (error) {
        console.error('Error fetching contacts:', error);
        toast.error('Failed to load contacts');
        return 0;
      }
      
      console.log('Contacts response:', data);
      
      return data?.total || 0;
    },
    enabled: filters.length > 0,
  });

  // Refetch when navigating to step 2
  useEffect(() => {
    if (step === 2 && filters.length > 0) {
      refetch();
    }
  }, [step, refetch]);

  const createCampaignMutation = useMutation({
    mutationFn: async ({ startImmediately }: { startImmediately: boolean }) => {
      // Clean filters by removing the 'id' field before sending
      const cleanedFilters = filters.map(({ id, ...rest }) => rest);
      
      const { data, error } = await supabase.functions.invoke('create-sales-campaign', {
        body: {
          name,
          description,
          agent_type: agentType,
          audience_filter: cleanedFilters,
          campaign_strategy: campaignStrategy,
          start_immediately: startImmediately,
          channel,
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
        return campaignStrategy.products.length > 0 && campaignStrategy.campaign_context.trim() !== "";
      default:
        return false;
    }
  };

  const quickFilters = [
    { label: "🔥 Hot Leads", filters: [{ id: crypto.randomUUID(), field: "likelihood_category", operator: "equals", value: "hot" }] },
    { label: "🟡 Warm Leads", filters: [{ id: crypto.randomUUID(), field: "likelihood_category", operator: "equals", value: "warm" }] },
    { label: "👑 VIP Only", filters: [{ id: crypto.randomUUID(), field: "customer_tier", operator: "equals", value: "VIP" }] },
    { label: "💰 High Spenders", filters: [{ id: crypto.randomUUID(), field: "total_spent", operator: "greater_than", value: 1000 }] },
    { label: "📈 High Score", filters: [{ id: crypto.randomUUID(), field: "likelihood_to_buy_score", operator: "greater_than", value: 70 }] },
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
              <Label htmlFor="channel">Channel *</Label>
              <Select value={channel} onValueChange={(value: "sms" | "email") => setChannel(value)}>
                <SelectTrigger id="channel">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sms">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="h-4 w-4" />
                      <span>SMS</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="email">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      <span>Email</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Agent Type</Label>
              <Card className="border-primary bg-primary/5">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    <CardTitle className="text-lg">Sales Agent (Sam)</CardTitle>
                  </div>
                  <CardDescription>
                    Sales campaigns use the Sales Agent for direct sales focus and conversion-oriented messaging.
                    Product agents (textbook, webinar, etc.) are assigned separately based on purchases or manual assignment.
                  </CardDescription>
                </CardHeader>
              </Card>
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

      {/* Step 3: Campaign Strategy */}
      {step === 3 && (
        <CampaignStrategyEditor
          strategy={campaignStrategy}
          onChange={setCampaignStrategy}
        />
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
              <Label>Channel</Label>
              <div className="flex items-center gap-2">
                {channel === 'sms' ? (
                  <MessageSquare className="h-4 w-4" />
                ) : (
                  <Mail className="h-4 w-4" />
                )}
                <Badge>{channel === 'sms' ? 'SMS' : 'Email'}</Badge>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Agent Type</Label>
              <Badge>Sales Agent (Sam)</Badge>
            </div>

            <div className="space-y-2">
              <Label>Target Audience</Label>
              <p className="text-2xl font-bold">{contactCount || 0} contacts</p>
              <p className="text-sm text-muted-foreground">{filters.length} filters applied</p>
            </div>

            <div className="space-y-2">
              <Label>Campaign Strategy</Label>
              <div className="space-y-1">
                <p className="text-sm"><strong>Objective:</strong> {campaignStrategy.primary_objective.replace("_", " ")}</p>
                <p className="text-sm"><strong>Products:</strong> {campaignStrategy.products.join(", ") || "None"}</p>
                <p className="text-sm"><strong>Sales Intensity:</strong> {campaignStrategy.sales_intensity}/10</p>
                <p className="text-sm"><strong>Discount Strategy:</strong> {campaignStrategy.discount_strategy.approach.replace("_", " ")}</p>
              </div>
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