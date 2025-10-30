import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, Plus } from "lucide-react";

interface CampaignStrategy {
  primary_objective: string;
  products: string[];
  value_propositions: string[];
  pricing: {
    base_price?: string;
    special_offer?: string;
  };
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
}

interface CampaignStrategyEditorProps {
  strategy: CampaignStrategy;
  onChange: (strategy: CampaignStrategy) => void;
}

export function CampaignStrategyEditor({ strategy, onChange }: CampaignStrategyEditorProps) {
  const [newProduct, setNewProduct] = useState("");
  const [newValueProp, setNewValueProp] = useState("");
  const [newTalkingPoint, setNewTalkingPoint] = useState("");
  const [newAvoidTopic, setNewAvoidTopic] = useState("");

  const updateStrategy = (updates: Partial<CampaignStrategy>) => {
    onChange({ ...strategy, ...updates });
  };

  const addItem = (field: keyof CampaignStrategy, value: string, setter: (val: string) => void) => {
    if (!value.trim()) return;
    const currentArray = strategy[field] as string[];
    updateStrategy({ [field]: [...currentArray, value.trim()] });
    setter("");
  };

  const removeItem = (field: keyof CampaignStrategy, index: number) => {
    const currentArray = strategy[field] as string[];
    updateStrategy({ [field]: currentArray.filter((_, i) => i !== index) });
  };

  const getSalesIntensityLabel = (value: number) => {
    if (value <= 3) return "Soft Touch (Educational)";
    if (value <= 7) return "Balanced Approach";
    return "Aggressive (Urgency-Driven)";
  };

  return (
    <div className="space-y-6">
      {/* Campaign Goals */}
      <Card>
        <CardHeader>
          <CardTitle>Campaign Goals</CardTitle>
          <CardDescription>Define what this campaign aims to achieve</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Primary Objective</Label>
            <Select
              value={strategy.primary_objective}
              onValueChange={(value) => updateStrategy({ primary_objective: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="close_sales">Close Sales</SelectItem>
                <SelectItem value="book_demos">Book Demos</SelectItem>
                <SelectItem value="webinar_signups">Drive Webinar Signups</SelectItem>
                <SelectItem value="upsell_customers">Upsell Existing Customers</SelectItem>
                <SelectItem value="reengage_leads">Re-engage Dormant Leads</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Product Details */}
      <Card>
        <CardHeader>
          <CardTitle>Product/Offering Details</CardTitle>
          <CardDescription>What are you promoting in this campaign?</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Products Being Promoted</Label>
            <div className="flex gap-2">
              <Input
                placeholder="Enter product name"
                value={newProduct}
                onChange={(e) => setNewProduct(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addItem("products", newProduct, setNewProduct)}
              />
              <Button
                type="button"
                size="sm"
                onClick={() => addItem("products", newProduct, setNewProduct)}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {strategy.products.map((product, idx) => (
                <Badge key={idx} variant="secondary" className="gap-1">
                  {product}
                  <X
                    className="h-3 w-3 cursor-pointer"
                    onClick={() => removeItem("products", idx)}
                  />
                </Badge>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Key Value Propositions</Label>
            <div className="flex gap-2">
              <Input
                placeholder="Why should customers buy?"
                value={newValueProp}
                onChange={(e) => setNewValueProp(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addItem("value_propositions", newValueProp, setNewValueProp)}
              />
              <Button
                type="button"
                size="sm"
                onClick={() => addItem("value_propositions", newValueProp, setNewValueProp)}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-1 mt-2">
              {strategy.value_propositions.map((prop, idx) => (
                <div key={idx} className="flex items-center gap-2 text-sm">
                  <span>• {prop}</span>
                  <X
                    className="h-3 w-3 cursor-pointer text-muted-foreground hover:text-foreground"
                    onClick={() => removeItem("value_propositions", idx)}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Base Price</Label>
              <Input
                placeholder="$99/month"
                value={strategy.pricing.base_price || ""}
                onChange={(e) =>
                  updateStrategy({
                    pricing: { ...strategy.pricing, base_price: e.target.value },
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Special Offer (Optional)</Label>
              <Input
                placeholder="Limited time pricing"
                value={strategy.pricing.special_offer || ""}
                onChange={(e) =>
                  updateStrategy({
                    pricing: { ...strategy.pricing, special_offer: e.target.value },
                  })
                }
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Discount Strategy</Label>
            <Select
              value={strategy.discount_strategy.approach}
              onValueChange={(value) =>
                updateStrategy({
                  discount_strategy: { ...strategy.discount_strategy, approach: value },
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="no_discounts">No discounts available</SelectItem>
                <SelectItem value="mention_if_hesitates">Mention discount if customer hesitates</SelectItem>
                <SelectItem value="lead_with_discount">Lead with discount offer</SelectItem>
              </SelectContent>
            </Select>
            {strategy.discount_strategy.approach !== "no_discounts" && (
              <div className="grid grid-cols-2 gap-4 mt-2">
                <div className="space-y-2">
                  <Label>Discount Amount</Label>
                  <Input
                    placeholder="20% off"
                    value={strategy.discount_strategy.amount || ""}
                    onChange={(e) =>
                      updateStrategy({
                        discount_strategy: {
                          ...strategy.discount_strategy,
                          amount: e.target.value,
                        },
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Expiration Date</Label>
                  <Input
                    type="date"
                    value={strategy.discount_strategy.expiration || ""}
                    onChange={(e) =>
                      updateStrategy({
                        discount_strategy: {
                          ...strategy.discount_strategy,
                          expiration: e.target.value,
                        },
                      })
                    }
                  />
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Sales Approach */}
      <Card>
        <CardHeader>
          <CardTitle>Sales Approach & Intensity</CardTitle>
          <CardDescription>How aggressively should the agent pursue this sale?</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label>Sales Pressure Level</Label>
              <Badge variant="outline">{getSalesIntensityLabel(strategy.sales_intensity)}</Badge>
            </div>
            <Slider
              value={[strategy.sales_intensity]}
              onValueChange={([value]) => updateStrategy({ sales_intensity: value })}
              min={1}
              max={10}
              step={1}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              {strategy.sales_intensity}/10 - {getSalesIntensityLabel(strategy.sales_intensity)}
            </p>
          </div>

          <div className="space-y-2">
            <Label>Objection Handling Approach</Label>
            <Select
              value={strategy.objection_handling}
              onValueChange={(value) => updateStrategy({ objection_handling: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="address_with_education">Address concerns with education</SelectItem>
                <SelectItem value="offer_alternatives">Offer alternatives or downgrades</SelectItem>
                <SelectItem value="use_discount">Use discount to overcome objections</SelectItem>
                <SelectItem value="escalate_to_human">Escalate to human sales rep</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Custom Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>Campaign-Specific Instructions</CardTitle>
          <CardDescription>Provide context and guidance for the AI agent</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Campaign Context</Label>
            <Textarea
              placeholder="E.g., 'This is our Q4 push for annual memberships. We're competing with a new competitor launch, so emphasize our 5-year track record and exclusive member community.'"
              value={strategy.campaign_context}
              onChange={(e) => updateStrategy({ campaign_context: e.target.value })}
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <Label>Key Talking Points</Label>
            <div className="flex gap-2">
              <Input
                placeholder="Add important points to emphasize"
                value={newTalkingPoint}
                onChange={(e) => setNewTalkingPoint(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addItem("key_talking_points", newTalkingPoint, setNewTalkingPoint)}
              />
              <Button
                type="button"
                size="sm"
                onClick={() => addItem("key_talking_points", newTalkingPoint, setNewTalkingPoint)}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-1 mt-2">
              {strategy.key_talking_points.map((point, idx) => (
                <div key={idx} className="flex items-center gap-2 text-sm">
                  <span>• {point}</span>
                  <X
                    className="h-3 w-3 cursor-pointer text-muted-foreground hover:text-foreground"
                    onClick={() => removeItem("key_talking_points", idx)}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Things to Avoid</Label>
            <div className="flex gap-2">
              <Input
                placeholder="Topics or approaches to stay away from"
                value={newAvoidTopic}
                onChange={(e) => setNewAvoidTopic(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addItem("avoid_topics", newAvoidTopic, setNewAvoidTopic)}
              />
              <Button
                type="button"
                size="sm"
                onClick={() => addItem("avoid_topics", newAvoidTopic, setNewAvoidTopic)}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {strategy.avoid_topics.map((topic, idx) => (
                <Badge key={idx} variant="destructive" className="gap-1">
                  {topic}
                  <X
                    className="h-3 w-3 cursor-pointer"
                    onClick={() => removeItem("avoid_topics", idx)}
                  />
                </Badge>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Competitive Positioning</Label>
            <Textarea
              placeholder="How should we position against competitors?"
              value={strategy.competitive_positioning}
              onChange={(e) => updateStrategy({ competitive_positioning: e.target.value })}
              rows={3}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
