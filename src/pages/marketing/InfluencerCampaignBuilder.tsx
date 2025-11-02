import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { FilterBuilder, FilterCondition } from "@/components/FilterBuilder";
import { PlatformBadge } from "@/components/marketing/PlatformBadge";

const STEPS = [
  { id: 1, name: "Details" },
  { id: 2, name: "Audience" },
  { id: 3, name: "Collaboration" },
  { id: 4, name: "Messages" },
  { id: 5, name: "Review" }
];

export default function InfluencerCampaignBuilder() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  
  const [campaignData, setCampaignData] = useState({
    name: "",
    description: "",
    campaign_type: "product_launch",
    platforms: [] as string[],
    start_date: "",
    end_date: "",
    audience_filter: [] as FilterCondition[],
    deliverables: {
      tiktok: { posts: 0, stories: 0, videos: 0 },
      youtube: { posts: 0, stories: 0, videos: 0 },
      instagram: { posts: 0, stories: 0, videos: 0 },
      blog: { posts: 0, stories: 0, videos: 0 },
      twitter: { posts: 0, stories: 0, videos: 0 }
    },
    compensation_model: "flat_fee",
    budget: "",
    brand_guidelines: "",
    required_hashtags: "",
    intro_template: "Hi {name}! We love your content on {platform}. We'd like to collaborate with you on {campaign_name}.",
    followup_template: "Hi {name}, just following up on our collaboration proposal. Let me know if you're interested!"
  });

  const [matchedInfluencers, setMatchedInfluencers] = useState<any[]>([]);

  const handleNext = async () => {
    if (step === 2) {
      // Fetch matched influencers
      await fetchMatchedInfluencers();
    }
    setStep(step + 1);
  };

  const handleBack = () => setStep(step - 1);

  const fetchMatchedInfluencers = async () => {
    const filters = campaignData.audience_filter;
    let query = supabase.from("contacts").select("*");
    
    // Apply platform filter
    if (campaignData.platforms.length > 0) {
      query = query.in("platform", campaignData.platforms);
    }
    
    // Apply other filters if any
    if (filters && Object.keys(filters).length > 0) {
      // Apply filters using the same logic as FilterBuilder
      // For now, just get influencers with platforms
      query = query.not("platform", "is", null);
    }
    
    const { data } = await query.limit(50);
    setMatchedInfluencers(data || []);
  };

  const handleLaunch = async () => {
    if (!campaignData.name) {
      toast.error("Campaign name is required");
      return;
    }

    setLoading(true);
    try {
      // Create AI sales campaign
      const { data: campaign, error: campaignError } = await supabase
        .from("ai_sales_campaigns")
        .insert([{
          name: campaignData.name,
          description: campaignData.description,
          agent_type: "influencer_outreach",
          channel: "sms",
          status: "active",
          start_date: campaignData.start_date || new Date().toISOString(),
          end_date: campaignData.end_date,
          audience_filter: campaignData.audience_filter as any,
          campaign_strategy: {
            campaign_type: campaignData.campaign_type,
            platforms: campaignData.platforms,
            deliverables: campaignData.deliverables,
            compensation_model: campaignData.compensation_model,
            budget: campaignData.budget,
            brand_guidelines: campaignData.brand_guidelines,
            required_hashtags: campaignData.required_hashtags?.split(",").map(h => h.trim()),
            intro_template: campaignData.intro_template,
            followup_template: campaignData.followup_template
          }
        }])
        .select()
        .single();

      if (campaignError) throw campaignError;

      // Create influencer campaign record
      const { error: influencerError } = await supabase
        .from("influencer_campaigns")
        .insert({
          campaign_id: campaign.id,
          campaign_type: campaignData.campaign_type,
          target_platforms: campaignData.platforms,
          target_reach: matchedInfluencers.reduce((sum, inf) => sum + (inf.follower_count || 0), 0),
          status: "active"
        });

      if (influencerError) throw influencerError;

      // Add matched influencers to campaign
      if (matchedInfluencers.length > 0) {
        const contacts = matchedInfluencers.map(inf => ({
          campaign_id: campaign.id,
          contact_id: inf.id,
          status: "pending"
        }));

        const { error: contactsError } = await supabase
          .from("ai_sales_campaign_contacts")
          .insert(contacts);

        if (contactsError) throw contactsError;
      }

      toast.success("Campaign launched successfully!");
      navigate(`/marketing/campaigns/${campaign.id}`);
    } catch (error: any) {
      console.error("Error launching campaign:", error);
      toast.error("Failed to launch campaign");
    } finally {
      setLoading(false);
    }
  };

  const togglePlatform = (platform: string) => {
    const platforms = [...campaignData.platforms];
    const index = platforms.indexOf(platform);
    if (index > -1) {
      platforms.splice(index, 1);
    } else {
      platforms.push(platform);
    }
    setCampaignData({ ...campaignData, platforms });
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/marketing")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Create Influencer Campaign</h1>
          <p className="text-muted-foreground">Step {step} of {STEPS.length}: {STEPS[step - 1].name}</p>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="flex gap-2">
        {STEPS.map((s) => (
          <div key={s.id} className="flex-1">
            <div className={`h-2 rounded-full ${s.id <= step ? 'bg-primary' : 'bg-muted'}`} />
            <p className={`text-xs mt-1 ${s.id === step ? 'font-medium' : 'text-muted-foreground'}`}>
              {s.name}
            </p>
          </div>
        ))}
      </div>

      {/* Step Content */}
      <Card>
        <CardContent className="pt-6">
          {/* Step 1: Campaign Details */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Campaign Name *</Label>
                <Input
                  id="name"
                  value={campaignData.name}
                  onChange={(e) => setCampaignData({ ...campaignData, name: e.target.value })}
                  placeholder="Summer Product Launch 2024"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={campaignData.description}
                  onChange={(e) => setCampaignData({ ...campaignData, description: e.target.value })}
                  placeholder="Brief description of the campaign..."
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="campaign_type">Campaign Type</Label>
                <Select
                  value={campaignData.campaign_type}
                  onValueChange={(value) => setCampaignData({ ...campaignData, campaign_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="product_launch">Product Launch</SelectItem>
                    <SelectItem value="brand_awareness">Brand Awareness</SelectItem>
                    <SelectItem value="event_promotion">Event Promotion</SelectItem>
                    <SelectItem value="seasonal">Seasonal Campaign</SelectItem>
                    <SelectItem value="ongoing">Ongoing Partnership</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Target Platforms *</Label>
                <div className="flex flex-wrap gap-2">
                  {["tiktok", "youtube", "instagram", "blog", "twitter"].map((platform) => (
                    <Button
                      key={platform}
                      type="button"
                      variant={campaignData.platforms.includes(platform) ? "default" : "outline"}
                      size="sm"
                      onClick={() => togglePlatform(platform)}
                    >
                      <PlatformBadge platform={platform} size="md" />
                    </Button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start_date">Start Date</Label>
                  <Input
                    id="start_date"
                    type="date"
                    value={campaignData.start_date}
                    onChange={(e) => setCampaignData({ ...campaignData, start_date: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end_date">End Date</Label>
                  <Input
                    id="end_date"
                    type="date"
                    value={campaignData.end_date}
                    onChange={(e) => setCampaignData({ ...campaignData, end_date: e.target.value })}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Audience Selection */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <h3 className="font-medium mb-2">Select Your Audience</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Use filters to target specific influencers. Matched influencers will be shown below.
                </p>
                <FilterBuilder
                  filters={campaignData.audience_filter}
                  onFiltersChange={(filters) => setCampaignData({ ...campaignData, audience_filter: filters })}
                />
              </div>

              {matchedInfluencers.length > 0 && (
                <div className="border-t pt-4">
                  <h4 className="font-medium mb-2">Matched Influencers ({matchedInfluencers.length})</h4>
                  <div className="max-h-60 overflow-y-auto space-y-2">
                    {matchedInfluencers.map((inf) => (
                      <div key={inf.id} className="flex items-center justify-between p-2 border rounded">
                        <div>
                          <p className="font-medium">{inf.full_name}</p>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            {inf.platform && <PlatformBadge platform={inf.platform} />}
                            {inf.follower_count && <span>{inf.follower_count.toLocaleString()} followers</span>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Collaboration Details */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Deliverables by Platform</Label>
                {campaignData.platforms.map((platform) => (
                  <div key={platform} className="border rounded p-3 space-y-2">
                    <div className="flex items-center gap-2 font-medium">
                      <PlatformBadge platform={platform} size="md" />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <Label className="text-xs">Posts</Label>
                        <Input
                          type="number"
                          min="0"
                          value={campaignData.deliverables[platform as keyof typeof campaignData.deliverables]?.posts || 0}
                          onChange={(e) => setCampaignData({
                            ...campaignData,
                            deliverables: {
                              ...campaignData.deliverables,
                              [platform]: {
                                ...campaignData.deliverables[platform as keyof typeof campaignData.deliverables],
                                posts: parseInt(e.target.value) || 0
                              }
                            }
                          })}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Stories</Label>
                        <Input
                          type="number"
                          min="0"
                          value={campaignData.deliverables[platform as keyof typeof campaignData.deliverables]?.stories || 0}
                          onChange={(e) => setCampaignData({
                            ...campaignData,
                            deliverables: {
                              ...campaignData.deliverables,
                              [platform]: {
                                ...campaignData.deliverables[platform as keyof typeof campaignData.deliverables],
                                stories: parseInt(e.target.value) || 0
                              }
                            }
                          })}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Videos</Label>
                        <Input
                          type="number"
                          min="0"
                          value={campaignData.deliverables[platform as keyof typeof campaignData.deliverables]?.videos || 0}
                          onChange={(e) => setCampaignData({
                            ...campaignData,
                            deliverables: {
                              ...campaignData.deliverables,
                              [platform]: {
                                ...campaignData.deliverables[platform as keyof typeof campaignData.deliverables],
                                videos: parseInt(e.target.value) || 0
                              }
                            }
                          })}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <Label htmlFor="compensation_model">Compensation Model</Label>
                <Select
                  value={campaignData.compensation_model}
                  onValueChange={(value) => setCampaignData({ ...campaignData, compensation_model: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="flat_fee">Flat Fee</SelectItem>
                    <SelectItem value="affiliate">Affiliate Commission</SelectItem>
                    <SelectItem value="product_only">Product Only</SelectItem>
                    <SelectItem value="hybrid">Hybrid (Fee + Commission)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="budget">Total Budget</Label>
                <Input
                  id="budget"
                  value={campaignData.budget}
                  onChange={(e) => setCampaignData({ ...campaignData, budget: e.target.value })}
                  placeholder="$5,000"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="brand_guidelines">Brand Guidelines & Content Brief</Label>
                <Textarea
                  id="brand_guidelines"
                  value={campaignData.brand_guidelines}
                  onChange={(e) => setCampaignData({ ...campaignData, brand_guidelines: e.target.value })}
                  placeholder="Key messaging, dos and don'ts, visual style..."
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="required_hashtags">Required Hashtags (comma-separated)</Label>
                <Input
                  id="required_hashtags"
                  value={campaignData.required_hashtags}
                  onChange={(e) => setCampaignData({ ...campaignData, required_hashtags: e.target.value })}
                  placeholder="#YourBrand, #CampaignName, #Sponsored"
                />
              </div>
            </div>
          )}

          {/* Step 4: Message Templates */}
          {step === 4 && (
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded-lg text-sm">
                <p className="font-medium mb-1">Available Variables:</p>
                <p className="text-muted-foreground">
                  {"{name}"}, {"{platform}"}, {"{campaign_name}"}, {"{followers}"}, {"{engagement_rate}"}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="intro_template">Initial Outreach Message</Label>
                <Textarea
                  id="intro_template"
                  value={campaignData.intro_template}
                  onChange={(e) => setCampaignData({ ...campaignData, intro_template: e.target.value })}
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="followup_template">Follow-up Message</Label>
                <Textarea
                  id="followup_template"
                  value={campaignData.followup_template}
                  onChange={(e) => setCampaignData({ ...campaignData, followup_template: e.target.value })}
                  rows={4}
                />
              </div>
            </div>
          )}

          {/* Step 5: Review & Launch */}
          {step === 5 && (
            <div className="space-y-6">
              <div className="space-y-4">
                <div>
                  <h3 className="font-medium mb-2">Campaign Overview</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Name:</p>
                      <p className="font-medium">{campaignData.name}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Type:</p>
                      <p className="font-medium capitalize">{campaignData.campaign_type.replace("_", " ")}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Platforms:</p>
                      <div className="flex gap-1 flex-wrap">
                        {campaignData.platforms.map(p => <PlatformBadge key={p} platform={p} />)}
                      </div>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Target Influencers:</p>
                      <p className="font-medium">{matchedInfluencers.length}</p>
                    </div>
                  </div>
                </div>

                <div className="p-4 border rounded-lg bg-primary/5">
                  <p className="text-sm">
                    Ready to launch! Your campaign will start reaching out to {matchedInfluencers.length} influencers
                    using the AI agent with your custom message templates.
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation Buttons */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={handleBack}
          disabled={step === 1 || loading}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>

        {step < STEPS.length ? (
          <Button onClick={handleNext} disabled={loading}>
            Next
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        ) : (
          <Button onClick={handleLaunch} disabled={loading} className="glow-green">
            <Check className="h-4 w-4 mr-2" />
            {loading ? "Launching..." : "Launch Campaign"}
          </Button>
        )}
      </div>
    </div>
  );
}
