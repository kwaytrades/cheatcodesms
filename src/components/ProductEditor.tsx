import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { X, Plus } from "lucide-react";
import { toast } from "sonner";

interface ProductEditorProps {
  product?: any;
  open: boolean;
  onClose: () => void;
}

export function ProductEditor({ product, open, onClose }: ProductEditorProps) {
  const queryClient = useQueryClient();
  const isEditing = !!product;

  const [formData, setFormData] = useState({
    name: "",
    sku: "",
    product_type: "course",
    description: "",
    price: "",
    is_active: true,
    features: [] as string[],
    benefits: [] as string[],
    value_propositions: [] as string[],
    key_talking_points: [] as string[],
    target_audience: "",
    competitive_positioning: "",
    objection_responses: {} as Record<string, string>,
  });

  const [newFeature, setNewFeature] = useState("");
  const [newBenefit, setNewBenefit] = useState("");
  const [newValueProp, setNewValueProp] = useState("");
  const [newTalkingPoint, setNewTalkingPoint] = useState("");
  const [newObjection, setNewObjection] = useState("");
  const [newResponse, setNewResponse] = useState("");

  useEffect(() => {
    if (product) {
      setFormData({
        name: product.name || "",
        sku: product.sku || "",
        product_type: product.product_type || "course",
        description: product.description || "",
        price: product.price?.toString() || "",
        is_active: product.is_active ?? true,
        features: product.features || [],
        benefits: product.benefits || [],
        value_propositions: product.value_propositions || [],
        key_talking_points: product.key_talking_points || [],
        target_audience: product.target_audience || "",
        competitive_positioning: product.competitive_positioning || "",
        objection_responses: product.objection_responses || {},
      });
    }
  }, [product]);

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      const payload = {
        ...data,
        price: data.price ? parseFloat(data.price) : null,
      };

      if (isEditing) {
        const { error } = await supabase
          .from("products")
          .update(payload)
          .eq("id", product.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("products").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success(isEditing ? "Product updated" : "Product created");
      onClose();
    },
    onError: (error: any) => {
      toast.error(`Failed to save product: ${error.message}`);
    },
  });

  const handleSave = () => {
    if (!formData.name.trim()) {
      toast.error("Product name is required");
      return;
    }
    saveMutation.mutate(formData);
  };

  const addArrayItem = (field: keyof typeof formData, value: string, setter: (val: string) => void) => {
    if (!value.trim()) return;
    setFormData(prev => ({
      ...prev,
      [field]: [...(prev[field] as string[]), value.trim()],
    }));
    setter("");
  };

  const removeArrayItem = (field: keyof typeof formData, index: number) => {
    setFormData(prev => ({
      ...prev,
      [field]: (prev[field] as string[]).filter((_, i) => i !== index),
    }));
  };

  const addObjection = () => {
    if (!newObjection.trim() || !newResponse.trim()) return;
    setFormData(prev => ({
      ...prev,
      objection_responses: {
        ...prev.objection_responses,
        [newObjection]: newResponse,
      },
    }));
    setNewObjection("");
    setNewResponse("");
  };

  const removeObjection = (key: string) => {
    setFormData(prev => {
      const { [key]: _, ...rest } = prev.objection_responses;
      return { ...prev, objection_responses: rest };
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Product" : "New Product"}</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="basic" className="mt-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="basic">Basic Info</TabsTrigger>
            <TabsTrigger value="sales">Sales Content</TabsTrigger>
            <TabsTrigger value="positioning">Positioning</TabsTrigger>
            <TabsTrigger value="objections">Objections</TabsTrigger>
          </TabsList>

          <TabsContent value="basic" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Product Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Premium Trading Course"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="sku">SKU</Label>
                <Input
                  id="sku"
                  value={formData.sku}
                  onChange={(e) => setFormData(prev => ({ ...prev, sku: e.target.value }))}
                  placeholder="e.g., PTC-001"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="product_type">Product Type</Label>
                <Select
                  value={formData.product_type}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, product_type: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="course">Course</SelectItem>
                    <SelectItem value="membership">Membership</SelectItem>
                    <SelectItem value="service">Service</SelectItem>
                    <SelectItem value="software">Software</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="price">Price ($)</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  value={formData.price}
                  onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))}
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Brief description of the product"
                rows={4}
              />
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
              />
              <Label htmlFor="is_active">Product is active</Label>
            </div>
          </TabsContent>

          <TabsContent value="sales" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Features</Label>
              <div className="flex gap-2">
                <Input
                  value={newFeature}
                  onChange={(e) => setNewFeature(e.target.value)}
                  placeholder="Add a feature"
                  onKeyPress={(e) => e.key === 'Enter' && addArrayItem('features', newFeature, setNewFeature)}
                />
                <Button type="button" onClick={() => addArrayItem('features', newFeature, setNewFeature)}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {formData.features.map((feature, idx) => (
                  <Badge key={idx} variant="secondary">
                    {feature}
                    <X
                      className="h-3 w-3 ml-1 cursor-pointer"
                      onClick={() => removeArrayItem('features', idx)}
                    />
                  </Badge>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Benefits</Label>
              <div className="flex gap-2">
                <Input
                  value={newBenefit}
                  onChange={(e) => setNewBenefit(e.target.value)}
                  placeholder="Add a benefit"
                  onKeyPress={(e) => e.key === 'Enter' && addArrayItem('benefits', newBenefit, setNewBenefit)}
                />
                <Button type="button" onClick={() => addArrayItem('benefits', newBenefit, setNewBenefit)}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {formData.benefits.map((benefit, idx) => (
                  <Badge key={idx} variant="secondary">
                    {benefit}
                    <X
                      className="h-3 w-3 ml-1 cursor-pointer"
                      onClick={() => removeArrayItem('benefits', idx)}
                    />
                  </Badge>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Value Propositions</Label>
              <div className="flex gap-2">
                <Input
                  value={newValueProp}
                  onChange={(e) => setNewValueProp(e.target.value)}
                  placeholder="Add a value proposition"
                  onKeyPress={(e) => e.key === 'Enter' && addArrayItem('value_propositions', newValueProp, setNewValueProp)}
                />
                <Button type="button" onClick={() => addArrayItem('value_propositions', newValueProp, setNewValueProp)}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {formData.value_propositions.map((vp, idx) => (
                  <Badge key={idx} variant="secondary">
                    {vp}
                    <X
                      className="h-3 w-3 ml-1 cursor-pointer"
                      onClick={() => removeArrayItem('value_propositions', idx)}
                    />
                  </Badge>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Key Talking Points</Label>
              <div className="flex gap-2">
                <Input
                  value={newTalkingPoint}
                  onChange={(e) => setNewTalkingPoint(e.target.value)}
                  placeholder="Add a talking point"
                  onKeyPress={(e) => e.key === 'Enter' && addArrayItem('key_talking_points', newTalkingPoint, setNewTalkingPoint)}
                />
                <Button type="button" onClick={() => addArrayItem('key_talking_points', newTalkingPoint, setNewTalkingPoint)}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {formData.key_talking_points.map((point, idx) => (
                  <Badge key={idx} variant="secondary">
                    {point}
                    <X
                      className="h-3 w-3 ml-1 cursor-pointer"
                      onClick={() => removeArrayItem('key_talking_points', idx)}
                    />
                  </Badge>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="positioning" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="target_audience">Target Audience</Label>
              <Textarea
                id="target_audience"
                value={formData.target_audience}
                onChange={(e) => setFormData(prev => ({ ...prev, target_audience: e.target.value }))}
                placeholder="Describe your ideal customer for this product"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="competitive_positioning">Competitive Positioning</Label>
              <Textarea
                id="competitive_positioning"
                value={formData.competitive_positioning}
                onChange={(e) => setFormData(prev => ({ ...prev, competitive_positioning: e.target.value }))}
                placeholder="How does this product compare to competitors?"
                rows={4}
              />
            </div>
          </TabsContent>

          <TabsContent value="objections" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Add Objection & Response</Label>
              <Input
                value={newObjection}
                onChange={(e) => setNewObjection(e.target.value)}
                placeholder="Common objection (e.g., 'Too expensive')"
              />
              <Textarea
                value={newResponse}
                onChange={(e) => setNewResponse(e.target.value)}
                placeholder="Your response to this objection"
                rows={3}
              />
              <Button type="button" onClick={addObjection}>
                <Plus className="h-4 w-4 mr-2" />
                Add Objection
              </Button>
            </div>

            <div className="space-y-3">
              {Object.entries(formData.objection_responses).map(([objection, response]) => (
                <div key={objection} className="border rounded-lg p-3 space-y-2">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <p className="font-medium text-sm">{objection}</p>
                      <p className="text-sm text-muted-foreground mt-1">{response}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeObjection(objection)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2 mt-6 pt-6 border-t">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? "Saving..." : "Save Product"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
