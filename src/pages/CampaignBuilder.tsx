import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, ArrowRight, Send } from "lucide-react";
import { toast } from "sonner";

const CampaignBuilder = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  
  // Campaign data
  const [campaignName, setCampaignName] = useState("");
  const [messageTemplate, setMessageTemplate] = useState("");
  const [estimatedContacts, setEstimatedContacts] = useState(0);

  const handleCreateCampaign = async () => {
    if (!campaignName || !messageTemplate) {
      toast.error("Please fill in all required fields");
      return;
    }

    setLoading(true);
    try {
      const { data: user } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from("campaigns")
        .insert({
          name: campaignName,
          message_template: messageTemplate,
          total_contacts: estimatedContacts,
          status: "draft",
          created_by: user.user?.id,
        })
        .select()
        .single();

      if (error) throw error;

      toast.success("Campaign created successfully!");
      navigate("/campaigns");
    } catch (error: any) {
      toast.error(error.message || "Failed to create campaign");
    } finally {
      setLoading(false);
    }
  };

  const progress = (step / 3) * 100;

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Create Campaign</h1>
            <p className="text-muted-foreground">Set up your SMS marketing campaign</p>
          </div>
          <Button variant="ghost" onClick={() => navigate("/campaigns")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </div>

        {/* Progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className={step >= 1 ? "text-primary font-medium" : "text-muted-foreground"}>
              Campaign Details
            </span>
            <span className={step >= 2 ? "text-primary font-medium" : "text-muted-foreground"}>
              Message
            </span>
            <span className={step >= 3 ? "text-primary font-medium" : "text-muted-foreground"}>
              Review & Launch
            </span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Step 1: Campaign Details */}
        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle>Campaign Details</CardTitle>
              <CardDescription>Give your campaign a name and select your audience</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="campaign-name">Campaign Name *</Label>
                <Input
                  id="campaign-name"
                  placeholder="e.g., Fall Product Launch"
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="contacts">Estimated Contacts</Label>
                <Input
                  id="contacts"
                  type="number"
                  placeholder="Enter number of contacts"
                  value={estimatedContacts || ""}
                  onChange={(e) => setEstimatedContacts(parseInt(e.target.value) || 0)}
                />
                <p className="text-sm text-muted-foreground">
                  Estimated cost: ${(estimatedContacts * 0.0079).toFixed(2)}
                </p>
              </div>

              <div className="p-4 bg-muted/50 rounded-lg border border-border/50">
                <h4 className="font-semibold mb-2">Audience Selection</h4>
                <p className="text-sm text-muted-foreground mb-3">
                  To filter contacts from Monday.com, you'll need to configure the Monday.com API key
                  in your backend settings.
                </p>
                <p className="text-sm text-muted-foreground">
                  For now, you can manually enter the estimated number of contacts above.
                </p>
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  onClick={() => setStep(2)}
                  disabled={!campaignName}
                >
                  Next: Compose Message
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Message Template */}
        {step === 2 && (
          <Card>
            <CardHeader>
              <CardTitle>Compose Message</CardTitle>
              <CardDescription>Write your SMS message template</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="message">Message Template *</Label>
                <Textarea
                  id="message"
                  placeholder="Hi {FirstName}, check out our new product..."
                  value={messageTemplate}
                  onChange={(e) => setMessageTemplate(e.target.value)}
                  rows={6}
                  maxLength={160}
                />
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Available merge fields: {"{FirstName}"}, {"{Product}"}, {"{LeadScore}"}</span>
                  <span>{messageTemplate.length}/160 characters</span>
                </div>
              </div>

              <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
                <h4 className="font-semibold mb-2 text-sm">Preview</h4>
                <p className="text-sm">
                  {messageTemplate.replace("{FirstName}", "John") || "Your message will appear here..."}
                </p>
              </div>

              <div className="flex justify-between gap-2">
                <Button variant="outline" onClick={() => setStep(1)}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
                <Button
                  onClick={() => setStep(3)}
                  disabled={!messageTemplate}
                >
                  Next: Review
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Review & Launch */}
        {step === 3 && (
          <Card>
            <CardHeader>
              <CardTitle>Review & Launch</CardTitle>
              <CardDescription>Review your campaign before sending</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-1">Campaign Name</h4>
                  <p className="text-muted-foreground">{campaignName}</p>
                </div>

                <div>
                  <h4 className="font-semibold mb-1">Message Template</h4>
                  <p className="text-muted-foreground">{messageTemplate}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-semibold mb-1">Total Contacts</h4>
                    <p className="text-muted-foreground">{estimatedContacts}</p>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-1">Estimated Cost</h4>
                    <p className="text-muted-foreground">${(estimatedContacts * 0.0079).toFixed(2)}</p>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-warning/10 rounded-lg border border-warning/20">
                <h4 className="font-semibold mb-2 text-sm flex items-center gap-2">
                  <Send className="h-4 w-4" />
                  Ready to Launch
                </h4>
                <p className="text-sm text-muted-foreground">
                  Your campaign will be created as a draft. To actually send messages, you'll need to:
                </p>
                <ul className="text-sm text-muted-foreground list-disc list-inside mt-2 space-y-1">
                  <li>Configure Twilio credentials in backend settings</li>
                  <li>Set up Monday.com integration for contact data</li>
                  <li>Activate the campaign from the campaigns list</li>
                </ul>
              </div>

              <div className="flex justify-between gap-2">
                <Button variant="outline" onClick={() => setStep(2)}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
                <Button
                  onClick={handleCreateCampaign}
                  disabled={loading}
                  className="gap-2"
                >
                  <Send className="h-4 w-4" />
                  {loading ? "Creating..." : "Create Campaign"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default CampaignBuilder;
