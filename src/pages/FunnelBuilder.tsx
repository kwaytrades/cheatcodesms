import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Trash2, Copy, Code, X, AlertCircle, Activity, CheckCircle2, XCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

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
  const [recentEvents, setRecentEvents] = useState<any[]>([]);
  const [testUrl, setTestUrl] = useState("");
  const [testResult, setTestResult] = useState<any>(null);
  const [isTestingUrl, setIsTestingUrl] = useState(false);

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

  const loadRecentEvents = async () => {
    if (!selectedFunnelId) return;

    const { data } = await supabase
      .from('funnel_step_events')
      .select(`
        *,
        funnel_steps (step_name),
        funnel_visits (session_id, device_type, browser, referrer)
      `)
      .order('created_at', { ascending: false })
      .limit(10);

    setRecentEvents(data || []);
  };

  const testUrlMatch = async () => {
    if (!testUrl) {
      toast.error("Please enter a URL to test");
      return;
    }

    setIsTestingUrl(true);
    try {
      const url = new URL(testUrl);
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-funnel-step`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pageUrl: testUrl,
          domain: url.hostname,
          path: url.pathname
        })
      });

      const result = await response.json();
      setTestResult(result);
      
      if (response.ok) {
        toast.success("URL matched a funnel step!");
      } else {
        toast.error("No funnel step found for this URL");
      }
    } catch (error) {
      console.error('Error testing URL:', error);
      toast.error("Failed to test URL");
      setTestResult({ error: "Failed to test URL" });
    } finally {
      setIsTestingUrl(false);
    }
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

            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" onClick={loadRecentEvents}>
                  <Activity className="h-4 w-4 mr-2" />
                  Test & Debug Tracking
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Tracking Debugger</DialogTitle>
                  <DialogDescription>
                    Test if your URLs match funnel steps and view recent tracking events
                  </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-6">
                  {/* URL Tester */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Test URL Match</CardTitle>
                      <CardDescription>
                        Enter a page URL to see if it matches any of your funnel steps
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex gap-2">
                        <Input
                          placeholder="https://yoursite.lovable.app/sales-page"
                          value={testUrl}
                          onChange={(e) => setTestUrl(e.target.value)}
                        />
                        <Button onClick={testUrlMatch} disabled={isTestingUrl}>
                          {isTestingUrl ? "Testing..." : "Test"}
                        </Button>
                      </div>
                      
                      {testResult && (
                        <Alert variant={testResult.error ? "destructive" : "default"}>
                          {testResult.error ? (
                            <>
                              <XCircle className="h-4 w-4" />
                              <AlertTitle>No Match Found</AlertTitle>
                              <AlertDescription>
                                The URL doesn't match any funnel step. Make sure your page URLs below exactly match where you installed the tracking code.
                              </AlertDescription>
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="h-4 w-4" />
                              <AlertTitle>Match Found!</AlertTitle>
                              <AlertDescription className="space-y-1">
                                <p><strong>Funnel:</strong> {testResult.funnelName}</p>
                                <p><strong>Step:</strong> {testResult.stepName} (Step {testResult.stepNumber})</p>
                                <p><strong>Type:</strong> {testResult.stepType}</p>
                              </AlertDescription>
                            </>
                          )}
                        </Alert>
                      )}
                    </CardContent>
                  </Card>

                  {/* Recent Events */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Recent Tracking Events</CardTitle>
                      <CardDescription>
                        Last 10 events tracked for this funnel
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {recentEvents.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          <Activity className="h-12 w-12 mx-auto mb-2 opacity-20" />
                          <p>No tracking events yet</p>
                          <p className="text-sm mt-1">Install the tracking code and visit a page to see events here</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {recentEvents.map((event, i) => (
                            <div key={i} className="flex items-start gap-3 p-3 border rounded-lg">
                              <Badge variant={event.event_name === 'page_view' ? 'default' : 'secondary'}>
                                {event.event_name}
                              </Badge>
                              <div className="flex-1 text-sm">
                                <p className="font-medium">{event.funnel_steps?.step_name}</p>
                                <p className="text-muted-foreground text-xs">
                                  {new Date(event.created_at).toLocaleString()}
                                </p>
                                {event.funnel_visits && (
                                  <p className="text-muted-foreground text-xs">
                                    {event.funnel_visits.device_type} • {event.funnel_visits.browser}
                                  </p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Tracking happens in real-time</AlertTitle>
                    <AlertDescription>
                      As soon as someone visits a page with the tracking code installed, events appear here within seconds. If you're not seeing events:
                      <ul className="list-disc list-inside mt-2 space-y-1">
                        <li>Make sure the tracking code is installed in the &lt;head&gt; section</li>
                        <li>Use the URL tester above to verify your page URLs match your funnel step URLs</li>
                        <li>Check your browser console for any JavaScript errors</li>
                        <li>The page URL must match EXACTLY (or use wildcards like https://site.com/*)</li>
                      </ul>
                    </AlertDescription>
                  </Alert>
                </div>
              </DialogContent>
            </Dialog>
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
