import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useWorkspace } from "@/contexts/WorkspaceContext";
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
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { currentWorkspace } = useWorkspace();
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
  const [verificationResults, setVerificationResults] = useState<any>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  useEffect(() => {
    loadFunnels();
  }, []);

  useEffect(() => {
    // Check if we should load a specific funnel from URL params
    const funnelIdFromUrl = searchParams.get('id');
    if (funnelIdFromUrl && funnels.length > 0) {
      setSelectedFunnelId(funnelIdFromUrl);
    }
  }, [searchParams, funnels]);

  useEffect(() => {
    if (selectedFunnelId) {
      loadFunnelData();
    }
  }, [selectedFunnelId]);

  const loadFunnels = async () => {
    if (!currentWorkspace) return;
    const { data } = await supabase
      .from('funnels')
      .select('*')
      .eq('workspace_id', currentWorkspace.id)
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
            workspace_id: currentWorkspace!.id,
          })
          .select()
          .single();

        if (funnelError) throw funnelError;

        // Insert steps
        const stepsToInsert = steps.map(step => ({
          funnel_id: newFunnel.id,
          workspace_id: currentWorkspace!.id,
          ...step
        }));

        await supabase
          .from('funnel_steps')
          .insert(stepsToInsert);

        setSelectedFunnelId(newFunnel.id);
        setIsCreating(false);
        toast.success("Funnel created successfully");
        
        // Redirect to analytics after 1 second
        setTimeout(() => {
          navigate('/analytics/funnels');
        }, 1000);
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
    // We need to provide instructions for both options
    return `<!-- Universal Funnel Tracking Code - Option 1: Use Hosted Script -->
<!-- Add this to <head> section of ALL funnel pages -->
<script>
  // Inline tracker for immediate use (no external file needed)
  window.FunnelTracker = {
    config: {},
    sessionId: null,
    
    init: function(options) {
      this.config = options || {};
      this.sessionId = this.getOrCreateSessionId();
      this.detectFunnelStep();
      this.trackPageView();
      this.trackTimeOnPage();
      this.trackScrollDepth();
      this.trackExitIntent();
    },
    
    getOrCreateSessionId: function() {
      const urlParams = new URLSearchParams(window.location.search);
      const sessionFromUrl = urlParams.get('session_id');
      if (sessionFromUrl) {
        localStorage.setItem('funnel_session_id', sessionFromUrl);
        return sessionFromUrl;
      }
      
      let sessionId = localStorage.getItem('funnel_session_id');
      if (!sessionId) {
        sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('funnel_session_id', sessionId);
      }
      return sessionId;
    },
    
    detectFunnelStep: async function() {
      try {
        const requestData = {
          pageUrl: window.location.href,
          domain: window.location.hostname,
          path: window.location.pathname
        };
        console.log('FunnelTracker: Detecting step for', requestData);
        
        const response = await fetch(this.config.apiEndpoint + '/get-funnel-step', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestData)
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.step_id) {
            this.currentStep = data;
            console.log('FunnelTracker: Step detected', data);
          } else {
            console.warn('FunnelTracker: No step found for this page', data);
          }
        } else {
          console.error('FunnelTracker: Failed to detect step', response.status);
        }
      } catch (error) {
        console.error('FunnelTracker: Error detecting step', error);
      }
    },
    
    trackPageView: function() {
      if (!this.currentStep) {
        console.warn('FunnelTracker: No step detected, skipping page view');
        return;
      }
      
      console.log('FunnelTracker: Tracking page view', this.currentStep);
      
      this.sendEvent({
        funnel_id: this.currentStep.funnel_id,
        step_id: this.currentStep.step_id,
        session_id: this.sessionId,
        event_type: 'page_view',
        utm_params: this.getUTMParams(),
        device_info: {
          device_type: this.getDeviceType(),
          browser: this.getBrowser()
        },
        referrer: document.referrer,
        metadata: this.collectMetadata()
      });
    },
    
    sendEvent: async function(eventData) {
      console.log('FunnelTracker: Sending event', eventData);
      try {
        const response = await fetch(this.config.apiEndpoint + '/track-funnel-event', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(eventData)
        });
        
        if (response.ok) {
          console.log('FunnelTracker: Event tracked successfully');
        } else {
          console.error('FunnelTracker: Failed to track event', response.status);
        }
      } catch (error) {
        console.error('FunnelTracker: Error sending event', error);
      }
    },
    
    getUTMParams: function() {
      const params = new URLSearchParams(window.location.search);
      return {
        utm_source: params.get('utm_source'),
        utm_medium: params.get('utm_medium'),
        utm_campaign: params.get('utm_campaign'),
        utm_content: params.get('utm_content'),
        utm_term: params.get('utm_term')
      };
    },
    
    getDeviceType: function() {
      const width = window.innerWidth;
      if (width < 768) return 'mobile';
      if (width < 1024) return 'tablet';
      return 'desktop';
    },
    
    getBrowser: function() {
      const ua = navigator.userAgent;
      if (ua.indexOf('Firefox') > -1) return 'Firefox';
      if (ua.indexOf('Chrome') > -1) return 'Chrome';
      if (ua.indexOf('Safari') > -1) return 'Safari';
      if (ua.indexOf('Edge') > -1) return 'Edge';
      return 'Unknown';
    },
    
    collectMetadata: function() {
      return {
        screen_width: window.screen.width,
        screen_height: window.screen.height,
        user_agent: navigator.userAgent,
        language: navigator.language,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
      };
    },
    
    trackTimeOnPage: function() {
      const startTime = Date.now();
      window.addEventListener('beforeunload', () => {
        const duration = Math.floor((Date.now() - startTime) / 1000);
        if (this.currentStep) {
          navigator.sendBeacon(
            this.config.apiEndpoint + '/track-funnel-event',
            JSON.stringify({
              funnel_id: this.currentStep.funnel_id,
              step_name: this.currentStep.step_name,
              session_id: this.sessionId,
              event_type: 'time_on_page',
              duration: duration
            })
          );
        }
      });
    },
    
    trackScrollDepth: function() {
      let maxScroll = 0;
      const thresholds = [25, 50, 75, 100];
      
      window.addEventListener('scroll', () => {
        const scrollPercent = Math.round((window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100);
        
        thresholds.forEach(threshold => {
          if (scrollPercent >= threshold && maxScroll < threshold) {
            maxScroll = threshold;
            if (this.currentStep) {
              this.sendEvent({
                funnel_id: this.currentStep.funnel_id,
                step_name: this.currentStep.step_name,
                session_id: this.sessionId,
                event_type: 'scroll_depth',
                metadata: { depth: threshold }
              });
            }
          }
        });
      });
    },
    
    trackExitIntent: function() {
      document.addEventListener('mouseleave', (e) => {
        if (e.clientY < 0 && this.currentStep) {
          this.sendEvent({
            funnel_id: this.currentStep.funnel_id,
            step_name: this.currentStep.step_name,
            session_id: this.sessionId,
            event_type: 'exit_intent'
          });
        }
      });
    },
    
    identify: async function(data) {
      const response = await fetch(this.config.apiEndpoint + '/identify-funnel-visitor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: this.sessionId,
          funnel_id: this.currentStep?.funnel_id,
          ...data
        })
      });
      return response.json();
    },
    
    conversion: async function(data) {
      const response = await fetch(this.config.apiEndpoint + '/track-funnel-conversion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: this.sessionId,
          funnel_id: this.currentStep?.funnel_id,
          ...data
        })
      });
      return response.json();
    }
  };

  // Auto-initialize
  window.FunnelTracker.init({
    apiEndpoint: '${import.meta.env.VITE_SUPABASE_URL}/functions/v1'
  });
</script>
<!-- End Tracking Code -->

<!-- OPTIONAL: For conversions on thank you/checkout pages, add: -->
<script>
  // After successful purchase
  FunnelTracker.conversion({
    contact_id: 'contact-uuid-here',
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

  const sendTestEvent = async () => {
    if (!selectedFunnelId || steps.length === 0) {
      toast.error("Please save your funnel first");
      return;
    }

    setIsVerifying(true);
    try {
      // Send a test tracking event
      const testSessionId = `test-${Date.now()}`;
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/track-funnel-event`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          funnel_id: selectedFunnelId,
          step_name: steps[0].step_name,
          session_id: testSessionId,
          event_type: 'page_view',
          utm_params: {
            utm_source: 'test',
            utm_campaign: 'verification'
          },
          device_info: {
            device_type: 'desktop',
            browser: 'Test Browser'
          },
          referrer: 'https://test.com',
          metadata: {
            test: true,
            timestamp: new Date().toISOString()
          }
        })
      });

      const result = await response.json();
      
      if (response.ok) {
        toast.success("Test event sent successfully! Check analytics.");
        // Reload events after a short delay
        setTimeout(() => {
          loadRecentEvents();
        }, 1000);
      } else {
        toast.error(`Failed to send test event: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error sending test event:', error);
      toast.error("Failed to send test event");
    } finally {
      setIsVerifying(false);
    }
  };

  const verifyInstallation = async () => {
    setIsVerifying(true);
    const results: any = {
      trackerScript: { status: 'checking', message: '' },
      getFunnelStep: { status: 'checking', message: '' },
      trackEvent: { status: 'checking', message: '' },
      recentEvents: { status: 'checking', message: '', count: 0 }
    };

    try {
      // Test 1: Check if tracker script is accessible
      try {
        const trackerUrl = `${window.location.origin}/funnel-tracker.js`;
        const trackerResponse = await fetch(trackerUrl);
        if (trackerResponse.ok) {
          results.trackerScript = { 
            status: 'success', 
            message: `Tracker accessible at ${trackerUrl}` 
          };
        } else {
          results.trackerScript = { 
            status: 'error', 
            message: `Tracker not found (${trackerResponse.status})` 
          };
        }
      } catch (error) {
        results.trackerScript = { 
          status: 'error', 
          message: 'Failed to fetch tracker script' 
        };
      }

      // Test 2: Check get-funnel-step API
      try {
        const testUrl = steps[0]?.page_url || 'https://example.com';
        const url = new URL(testUrl);
        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-funnel-step`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pageUrl: testUrl,
            domain: url.hostname,
            path: url.pathname
          })
        });
        
        if (response.ok) {
          const data = await response.json();
          results.getFunnelStep = { 
            status: 'success', 
            message: 'API responding - Step found',
            data
          };
        } else {
          results.getFunnelStep = { 
            status: 'warning', 
            message: `API responding but no step match found (this is normal if tracking code isn't installed yet)` 
          };
        }
      } catch (error) {
        results.getFunnelStep = { 
          status: 'error', 
          message: 'Failed to call get-funnel-step API' 
        };
      }

      // Test 3: Try sending a test event
      try {
        const testSessionId = `verify-${Date.now()}`;
        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/track-funnel-event`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            funnel_id: selectedFunnelId,
            step_name: steps[0]?.step_name || 'Test',
            session_id: testSessionId,
            event_type: 'page_view',
            utm_params: { utm_source: 'verification' },
            device_info: { device_type: 'desktop', browser: 'Test' },
            referrer: 'verification-test',
            metadata: { test: true }
          })
        });

        if (response.ok) {
          results.trackEvent = { 
            status: 'success', 
            message: 'Successfully sent test tracking event' 
          };
        } else {
          const errorData = await response.json();
          results.trackEvent = { 
            status: 'error', 
            message: `Failed to track event: ${errorData.error || 'Unknown error'}` 
          };
        }
      } catch (error) {
        results.trackEvent = { 
          status: 'error', 
          message: 'Failed to send tracking event' 
        };
      }

      // Test 4: Check if events table has recent data
      if (selectedFunnelId) {
        const { data, count } = await supabase
          .from('funnel_step_events')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
        
        if (count && count > 0) {
          results.recentEvents = { 
            status: 'success', 
            message: `${count} events in last 24 hours`,
            count 
          };
        } else {
          results.recentEvents = { 
            status: 'warning', 
            message: 'No events received in last 24 hours',
            count: 0
          };
        }
      }

      setVerificationResults(results);
      
      // Show overall result
      if (results.trackEvent.status === 'success') {
        toast.success("Verification complete - tracking is working!");
      } else {
        toast.warning("Verification complete - see results below");
      }
    } catch (error) {
      console.error('Verification error:', error);
      toast.error("Failed to complete verification");
    } finally {
      setIsVerifying(false);
    }
  };

  const deleteFunnel = async () => {
    if (!selectedFunnelId) return;

    try {
      // First get all step IDs for this funnel
      const { data: steps } = await supabase
        .from('funnel_steps')
        .select('id')
        .eq('funnel_id', selectedFunnelId);

      const stepIds = steps?.map(s => s.id) || [];

      // Delete in order: events -> visits -> steps -> funnel
      if (stepIds.length > 0) {
        await supabase
          .from('funnel_step_events')
          .delete()
          .in('step_id', stepIds);
      }

      await supabase
        .from('funnel_visits')
        .delete()
        .eq('funnel_id', selectedFunnelId);

      await supabase
        .from('funnel_steps')
        .delete()
        .eq('funnel_id', selectedFunnelId);

      await supabase
        .from('funnels')
        .delete()
        .eq('id', selectedFunnelId);

      toast.success("Funnel deleted successfully");
      setSelectedFunnelId("");
      setShowDeleteDialog(false);
      loadFunnels();
    } catch (error) {
      console.error('Error deleting funnel:', error);
      toast.error("Failed to delete funnel");
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
          {selectedFunnelId && (
            <Button 
              variant="destructive" 
              size="icon"
              onClick={() => setShowDeleteDialog(true)}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
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
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Important: Installation Required</AlertTitle>
              <AlertDescription>
                <p className="mb-2">This tracking code must be installed on your <strong>external website</strong> (e.g., {steps[0]?.page_url || 'your-site.com'}). Add it to the &lt;head&gt; section of all funnel pages.</p>
                <p className="text-sm mb-2">The "Send Test Event" button works because it's calling the API directly. For real visitor tracking, you must install the code on your external site.</p>
                <p className="text-sm font-semibold">Steps to install:</p>
                <ol className="text-sm list-decimal list-inside space-y-1">
                  <li>Copy the tracking code below</li>
                  <li>Paste it in the &lt;head&gt; section of your website</li>
                  <li>Visit your website to generate a real event</li>
                  <li>Check this analytics dashboard to see the data</li>
                </ol>
              </AlertDescription>
            </Alert>
            
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

            <div className="flex gap-2">
              <Button 
                variant="default" 
                onClick={sendTestEvent} 
                disabled={isVerifying || !selectedFunnelId}
              >
                <Activity className="h-4 w-4 mr-2" />
                {isVerifying ? "Sending..." : "Send Test Event"}
              </Button>
              
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" onClick={verifyInstallation} disabled={isVerifying || !selectedFunnelId}>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    {isVerifying ? "Verifying..." : "Verify Installation"}
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Installation Verification</DialogTitle>
                    <DialogDescription>
                      Testing your funnel tracking setup
                    </DialogDescription>
                  </DialogHeader>
                  
                  {verificationResults && (
                    <div className="space-y-3">
                      {/* Tracker Script */}
                      <div className="flex items-start gap-3 p-3 border rounded-lg">
                        {verificationResults.trackerScript.status === 'success' ? (
                          <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
                        ) : verificationResults.trackerScript.status === 'warning' ? (
                          <AlertCircle className="h-5 w-5 text-yellow-500 mt-0.5" />
                        ) : (
                          <XCircle className="h-5 w-5 text-red-500 mt-0.5" />
                        )}
                        <div className="flex-1">
                          <p className="font-medium">Tracker Script</p>
                          <p className="text-sm text-muted-foreground">{verificationResults.trackerScript.message}</p>
                        </div>
                      </div>

                      {/* Get Funnel Step API */}
                      <div className="flex items-start gap-3 p-3 border rounded-lg">
                        {verificationResults.getFunnelStep.status === 'success' ? (
                          <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
                        ) : verificationResults.getFunnelStep.status === 'warning' ? (
                          <AlertCircle className="h-5 w-5 text-yellow-500 mt-0.5" />
                        ) : (
                          <XCircle className="h-5 w-5 text-red-500 mt-0.5" />
                        )}
                        <div className="flex-1">
                          <p className="font-medium">Get Funnel Step API</p>
                          <p className="text-sm text-muted-foreground">{verificationResults.getFunnelStep.message}</p>
                        </div>
                      </div>

                      {/* Track Event API */}
                      <div className="flex items-start gap-3 p-3 border rounded-lg">
                        {verificationResults.trackEvent.status === 'success' ? (
                          <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
                        ) : verificationResults.trackEvent.status === 'warning' ? (
                          <AlertCircle className="h-5 w-5 text-yellow-500 mt-0.5" />
                        ) : (
                          <XCircle className="h-5 w-5 text-red-500 mt-0.5" />
                        )}
                        <div className="flex-1">
                          <p className="font-medium">Track Event API</p>
                          <p className="text-sm text-muted-foreground">{verificationResults.trackEvent.message}</p>
                        </div>
                      </div>

                      {/* Recent Events */}
                      <div className="flex items-start gap-3 p-3 border rounded-lg">
                        {verificationResults.recentEvents.status === 'success' ? (
                          <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
                        ) : verificationResults.recentEvents.status === 'warning' ? (
                          <AlertCircle className="h-5 w-5 text-yellow-500 mt-0.5" />
                        ) : (
                          <XCircle className="h-5 w-5 text-red-500 mt-0.5" />
                        )}
                        <div className="flex-1">
                          <p className="font-medium">Recent Events</p>
                          <p className="text-sm text-muted-foreground">{verificationResults.recentEvents.message}</p>
                        </div>
                      </div>

                      {/* Troubleshooting */}
                      {(verificationResults.trackerScript.status === 'error' || 
                        verificationResults.trackEvent.status === 'error' ||
                        verificationResults.recentEvents.status === 'warning') && (
                        <Alert>
                          <AlertCircle className="h-4 w-4" />
                          <AlertTitle>Troubleshooting Tips</AlertTitle>
                          <AlertDescription>
                            <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                              <li>Use "Send Test Event" button to test the tracking system</li>
                              <li>Make sure the tracking code is in the &lt;head&gt; section of your website</li>
                              <li>Verify the page URL exactly matches a funnel step</li>
                              <li>Check browser console for JavaScript errors</li>
                              <li>Test on the actual domain (not localhost)</li>
                            </ul>
                          </AlertDescription>
                        </Alert>
                      )}
                    </div>
                  )}
                </DialogContent>
              </Dialog>
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

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Funnel</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this funnel? This will also delete all associated steps, visits, and events. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={deleteFunnel}>
              Delete Funnel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
