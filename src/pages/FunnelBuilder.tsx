import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Trash2, Copy, Code, X, AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

interface FunnelStep {
  id?: string;
  step_number: number;
  step_name: string;
  step_type: string;
  page_url: string;
  conversion_goal: string;
}

export default function FunnelBuilder() {
  const [funnels, setFunnels] = useState<any[]>([]);
  const [selectedFunnelId, setSelectedFunnelId] = useState<string>("");
  const [funnelName, setFunnelName] = useState("");
  const [funnelDescription, setFunnelDescription] = useState("");
  const [steps, setSteps] = useState<FunnelStep[]>([
    { step_number: 1, step_name: "Landing Page", step_type: "landing", page_url: "", conversion_goal: "View page" }
  ]);
  const [isCreating, setIsCreating] = useState(false);
  const [trackingCode, setTrackingCode] = useState("");

  useEffect(() => {
    loadFunnels();
  }, []);

  useEffect(() => {
    if (selectedFunnelId) {
      loadFunnelData();
    }
  }, [selectedFunnelId]);

  const loadFunnels = async () => {
    const { data } = await supabase
      .from('funnels')
      .select('*')
      .order('created_at', { ascending: false });
    
    setFunnels(data || []);
  };

  const loadFunnelData = async () => {
    const { data: funnel } = await supabase
      .from('funnels')
      .select('*')
      .eq('id', selectedFunnelId)
      .single();

    if (funnel) {
      setFunnelName(funnel.name);
      setFunnelDescription(funnel.description || "");
    }

    const { data: stepsData } = await supabase
      .from('funnel_steps')
      .select('*')
      .eq('funnel_id', selectedFunnelId)
      .order('step_number');

    if (stepsData && stepsData.length > 0) {
      setSteps(stepsData);
    }
  };

  const createNewFunnel = () => {
    setSelectedFunnelId("");
    setFunnelName("");
    setFunnelDescription("");
    setSteps([
      { step_number: 1, step_name: "Landing Page", step_type: "landing", page_url: "", conversion_goal: "View page" }
    ]);
    setIsCreating(true);
  };

  const saveFunnel = async () => {
    if (!funnelName) {
      toast.error("Please enter a funnel name");
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (selectedFunnelId) {
        // Update existing funnel
        await supabase
          .from('funnels')
          .update({ name: funnelName, description: funnelDescription })
          .eq('id', selectedFunnelId);

        // Delete old steps
        await supabase
          .from('funnel_steps')
          .delete()
          .eq('funnel_id', selectedFunnelId);

        // Insert new steps
        const stepsToInsert = steps.map(step => ({
          funnel_id: selectedFunnelId,
          ...step
        }));

        await supabase
          .from('funnel_steps')
          .insert(stepsToInsert);

        toast.success("Funnel updated successfully");
      } else {
        // Create new funnel
        const { data: newFunnel, error: funnelError } = await supabase
          .from('funnels')
          .insert({
            name: funnelName,
            description: funnelDescription,
            created_by: user?.id,
          })
          .select()
          .single();

        if (funnelError) throw funnelError;

        // Insert steps
        const stepsToInsert = steps.map(step => ({
          funnel_id: newFunnel.id,
          ...step
        }));

        await supabase
          .from('funnel_steps')
          .insert(stepsToInsert);

        setSelectedFunnelId(newFunnel.id);
        setIsCreating(false);
        toast.success("Funnel created successfully");
      }

      loadFunnels();
    } catch (error) {
      console.error('Error saving funnel:', error);
      toast.error("Failed to save funnel");
    }
  };

  const addStep = () => {
    setSteps([...steps, {
      step_number: steps.length + 1,
      step_name: "",
      step_type: "sales",
      page_url: "",
      conversion_goal: ""
    }]);
  };

  const removeStep = (index: number) => {
    const newSteps = steps.filter((_, i) => i !== index);
    setSteps(newSteps.map((step, i) => ({ ...step, step_number: i + 1 })));
  };

  const updateStep = (index: number, field: keyof FunnelStep, value: string | number) => {
    const newSteps = [...steps];
    newSteps[index] = { ...newSteps[index], [field]: value };
    setSteps(newSteps);
  };

  const getUniversalTrackingCode = () => {
    const currentDomain = window.location.origin;
    
    return `<!-- Universal Funnel Tracking Code -->
<!-- Add this to <head> section of ALL funnel pages across ALL projects -->
<script src="${currentDomain}/funnel-tracker.js"></script>
<script>
  window.FunnelTracker.init({
    apiEndpoint: '${import.meta.env.VITE_SUPABASE_URL}/functions/v1'
  });
</script>
<!-- End Tracking Code -->

<!-- OPTIONAL: For conversions on thank you/checkout pages, add: -->
<script>
  // After successful purchase
  FunnelTracker.conversion({
    orderValue: 297.00,
    productId: 'your-product-id',
    conversionType: 'purchase'
  });
</script>

<!-- OPTIONAL: After form submission to identify visitor, add: -->
<script>
  // After user submits form
  FunnelTracker.identify({
    email: 'user@example.com',
    phone: '+1234567890',
    name: 'John Doe'
  });
</script>`;
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Tracking code copied to clipboard");
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Funnel Builder</h1>
          <p className="text-muted-foreground">Create and manage your sales funnels</p>
        </div>
        <div className="flex gap-2">
          <Select value={selectedFunnelId} onValueChange={setSelectedFunnelId}>
            <SelectTrigger className="w-[300px]">
              <SelectValue placeholder="Select a funnel" />
            </SelectTrigger>
            <SelectContent>
              {funnels.map(funnel => (
                <SelectItem key={funnel.id} value={funnel.id}>
                  {funnel.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={createNewFunnel}>
            <Plus className="w-4 h-4 mr-2" />
            New Funnel
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Funnel Details</CardTitle>
          <CardDescription>Configure your funnel settings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="funnel-name">Funnel Name</Label>
            <Input
              id="funnel-name"
              value={funnelName}
              onChange={(e) => setFunnelName(e.target.value)}
              placeholder="e.g., Main Product Funnel"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="funnel-description">Description (Optional)</Label>
            <Textarea
              id="funnel-description"
              value={funnelDescription}
              onChange={(e) => setFunnelDescription(e.target.value)}
              placeholder="Describe your funnel..."
            />
          </div>
        </CardContent>
      </Card>

      {/* Universal Tracking Code Section */}
      {selectedFunnelId && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Code className="h-5 w-5" />
              Universal Tracking Code
            </CardTitle>
            <CardDescription>
              One code snippet that works across ALL your funnel pages. The tracker auto-detects which step the visitor is on.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Textarea
                value={getUniversalTrackingCode()}
                readOnly
                className="font-mono text-xs h-64"
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="absolute top-2 right-2"
                onClick={() => copyToClipboard(getUniversalTrackingCode())}
              >
                <Copy className="h-4 w-4 mr-1" />
                Copy
              </Button>
            </div>
            
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Installation Instructions</AlertTitle>
              <AlertDescription className="space-y-2">
                <p>1. Add this tracking code to the &lt;head&gt; section of ALL pages in ALL your funnel projects</p>
                <p>2. The tracker will automatically detect which funnel step each visitor is on based on the page URLs you configured below</p>
                <p>3. For cross-domain tracking between different Lovable projects, use: <code className="text-xs bg-muted px-1 py-0.5 rounded">FunnelTracker.addSessionToUrl(url)</code></p>
                <p>4. Use the optional conversion and identify scripts on checkout/thank you pages to track purchases and identify visitors</p>
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Funnel Steps Configuration</CardTitle>
          <CardDescription>Define the page URLs for each step so the tracker can auto-detect them</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {steps.map((step, index) => (
            <Card key={index}>
              <CardContent className="pt-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Step {step.step_number}</h3>
                  {steps.length > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeStep(index)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Step Name</Label>
                    <Input
                      value={step.step_name}
                      onChange={(e) => updateStep(index, 'step_name', e.target.value)}
                      placeholder="e.g., Sales Page"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Step Type</Label>
                    <Select
                      value={step.step_type}
                      onValueChange={(value) => updateStep(index, 'step_type', value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="landing">Landing Page</SelectItem>
                        <SelectItem value="sales">Sales Page</SelectItem>
                        <SelectItem value="checkout">Checkout</SelectItem>
                        <SelectItem value="upsell">Upsell</SelectItem>
                        <SelectItem value="downsell">Downsell</SelectItem>
                        <SelectItem value="thank-you">Thank You</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>Page URL Pattern</Label>
                    <Input
                      value={step.page_url}
                      onChange={(e) => updateStep(index, 'page_url', e.target.value)}
                      placeholder="https://yoursite.com/sales-page or use * for wildcards"
                    />
                    <p className="text-xs text-muted-foreground">
                      Examples: Exact: https://site.com/page | Wildcard: https://site.com/* | Path: */checkout
                    </p>
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>Conversion Goal</Label>
                    <Input
                      value={step.conversion_goal}
                      onChange={(e) => updateStep(index, 'conversion_goal', e.target.value)}
                      placeholder="e.g., Click checkout button"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          <Button onClick={addStep} variant="outline" className="w-full">
            <Plus className="w-4 h-4 mr-2" />
            Add Step
          </Button>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button onClick={saveFunnel}>
          {selectedFunnelId ? "Update Funnel" : "Create Funnel"}
        </Button>
      </div>
    </div>
  );
}
