import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ChevronLeft, Loader2, Save } from "lucide-react";
import { FilterBuilder } from "@/components/FilterBuilder";
import { CampaignStrategyEditor } from "@/components/CampaignStrategyEditor";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function SalesCampaignEdit() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [filters, setFilters] = useState<any[]>([]);
  const [campaignStrategy, setCampaignStrategy] = useState<any>({
    primary_objective: "close_sales",
    products: [],
    value_propositions: [],
    pricing: {},
    discount_strategy: { approach: "no_discounts" },
    sales_intensity: 5,
    objection_handling: "address_with_education",
    campaign_context: "",
    key_talking_points: [],
    avoid_topics: [],
    competitive_positioning: "",
  });

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

  useEffect(() => {
    if (campaign) {
      setName(campaign.name || "");
      setDescription(campaign.description || "");
      setFilters(Array.isArray(campaign.audience_filter) ? campaign.audience_filter : []);
      setCampaignStrategy(campaign.campaign_strategy || campaignStrategy);
    }
  }, [campaign]);

  const updateCampaignMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('ai_sales_campaigns')
        .update({
          name,
          description,
          audience_filter: filters,
          campaign_strategy: campaignStrategy,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Campaign updated successfully!");
      navigate(`/sales-campaigns/${id}`);
    },
    onError: (error) => {
      toast.error(`Failed to update campaign: ${error.message}`);
    },
  });

  if (isLoading) {
    return <div className="container mx-auto p-6">Loading campaign...</div>;
  }

  if (!campaign) {
    return <div className="container mx-auto p-6">Campaign not found</div>;
  }

  if (campaign.status === 'active') {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>Cannot Edit Active Campaign</CardTitle>
            <CardDescription>
              Please pause the campaign before making changes.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate(`/sales-campaigns/${id}`)}>
              Back to Campaign
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-5xl">
      <div className="mb-6">
        <Button variant="ghost" onClick={() => navigate(`/sales-campaigns/${id}`)}>
          <ChevronLeft className="h-4 w-4 mr-2" />
          Back to Campaign
        </Button>
        <h1 className="text-3xl font-bold mt-4">Edit Campaign: {campaign.name}</h1>
      </div>

      <Tabs defaultValue="details" className="space-y-4">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="audience">Audience</TabsTrigger>
          <TabsTrigger value="strategy">Strategy</TabsTrigger>
        </TabsList>

        <TabsContent value="details">
          <Card>
            <CardHeader>
              <CardTitle>Campaign Details</CardTitle>
              <CardDescription>Update campaign name and description</CardDescription>
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
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Describe the goal of this campaign..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audience">
          <Card>
            <CardHeader>
              <CardTitle>Target Audience</CardTitle>
              <CardDescription>Update audience filters</CardDescription>
            </CardHeader>
            <CardContent>
              <FilterBuilder
                filters={filters}
                onFiltersChange={setFilters}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="strategy">
          <CampaignStrategyEditor
            strategy={campaignStrategy}
            onChange={setCampaignStrategy}
          />
        </TabsContent>
      </Tabs>

      <div className="flex justify-end gap-4 mt-6">
        <Button
          variant="outline"
          onClick={() => navigate(`/sales-campaigns/${id}`)}
        >
          Cancel
        </Button>
        <Button
          onClick={() => updateCampaignMutation.mutate()}
          disabled={updateCampaignMutation.isPending || !name.trim()}
        >
          {updateCampaignMutation.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Save Changes
        </Button>
      </div>
    </div>
  );
}
