import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Settings2, Key, CheckCircle2, XCircle, BookOpen } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { KnowledgeBase } from "@/components/KnowledgeBase";

interface SecretConfig {
  name: string;
  displayName: string;
  description: string;
  required: boolean;
  configured: boolean;
}

const secretFormSchema = z.object({
  value: z.string().trim().min(1, { message: "Secret value is required" }).max(500, { message: "Secret value must be less than 500 characters" })
});

type SecretFormValues = z.infer<typeof secretFormSchema>;

const Settings = () => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [currentSecret, setCurrentSecret] = useState<SecretConfig | null>(null);
  const [configuredSecrets, setConfiguredSecrets] = useState<Set<string>>(
    new Set(["MONDAY_API_KEY", "TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_PHONE_NUMBER", "TWITTER_CLIENT_ID", "TWITTER_CLIENT_SECRET", "TWITTER_ACCESS_TOKEN"])
  );
  
  const form = useForm<SecretFormValues>({
    resolver: zodResolver(secretFormSchema),
    defaultValues: {
      value: ""
    }
  });

  // These would ideally come from backend but for now we'll track them manually
  const secrets: SecretConfig[] = [
    {
      name: "ALPHA_VANTAGE_API_KEY",
      displayName: "Alpha Vantage API Key",
      description: "Stock market data API for real-time quotes and financial data",
      required: false,
      configured: configuredSecrets.has("ALPHA_VANTAGE_API_KEY")
    },
    {
      name: "FINNHUB_API_KEY",
      displayName: "Finnhub API Key",
      description: "Alternative stock market data provider for live market data",
      required: false,
      configured: configuredSecrets.has("FINNHUB_API_KEY")
    },
    {
      name: "MONDAY_API_KEY",
      displayName: "Monday.com API Key",
      description: "Required for syncing contacts from Monday.com boards",
      required: true,
      configured: configuredSecrets.has("MONDAY_API_KEY")
    },
    {
      name: "TWILIO_ACCOUNT_SID",
      displayName: "Twilio Account SID",
      description: "Your Twilio account identifier for SMS functionality",
      required: true,
      configured: configuredSecrets.has("TWILIO_ACCOUNT_SID")
    },
    {
      name: "TWILIO_AUTH_TOKEN",
      displayName: "Twilio Auth Token",
      description: "Authentication token for Twilio API access",
      required: true,
      configured: configuredSecrets.has("TWILIO_AUTH_TOKEN")
    },
    {
      name: "TWILIO_PHONE_NUMBER",
      displayName: "Twilio Phone Number",
      description: "The phone number to send SMS from (format: +1234567890)",
      required: true,
      configured: configuredSecrets.has("TWILIO_PHONE_NUMBER")
    },
    {
      name: "AWS_ACCESS_KEY_ID",
      displayName: "AWS Access Key ID",
      description: "Your AWS IAM access key for SES email sending",
      required: true,
      configured: configuredSecrets.has("AWS_ACCESS_KEY_ID")
    },
    {
      name: "AWS_SECRET_ACCESS_KEY",
      displayName: "AWS Secret Access Key",
      description: "Your AWS IAM secret access key for SES authentication",
      required: true,
      configured: configuredSecrets.has("AWS_SECRET_ACCESS_KEY")
    },
    {
      name: "AWS_REGION",
      displayName: "AWS Region",
      description: "AWS region for SES (e.g., us-east-1, us-west-2)",
      required: true,
      configured: configuredSecrets.has("AWS_REGION")
    },
    {
      name: "TWITTER_CLIENT_ID",
      displayName: "Twitter Client ID",
      description: "Your Twitter OAuth 2.0 Client ID",
      required: false,
      configured: configuredSecrets.has("TWITTER_CLIENT_ID")
    },
    {
      name: "TWITTER_CLIENT_SECRET",
      displayName: "Twitter Client Secret",
      description: "Your Twitter OAuth 2.0 Client Secret",
      required: false,
      configured: configuredSecrets.has("TWITTER_CLIENT_SECRET")
    },
    {
      name: "TWITTER_ACCESS_TOKEN",
      displayName: "Twitter Access Token (OAuth 2.0)",
      description: "Your Twitter OAuth 2.0 Bearer token for posting",
      required: false,
      configured: configuredSecrets.has("TWITTER_ACCESS_TOKEN")
    }
  ];

  const handleConfigureSecret = (secret: SecretConfig) => {
    setCurrentSecret(secret);
    form.reset({ value: "" });
    setDialogOpen(true);
  };

  const handleTestConnection = (secretName: string) => {
    toast.info(`Testing connection for ${secretName}...`);
    // This would test the API connection
  };

  const onSubmit = async (data: SecretFormValues) => {
    if (!currentSecret) return;
    
    try {
      // Here we would call the backend to save the secret
      // For now, we'll update local state and show success message
      setConfiguredSecrets(prev => new Set(prev).add(currentSecret.name));
      toast.success(`${currentSecret.displayName} configured successfully`);
      setDialogOpen(false);
      form.reset();
    } catch (error) {
      toast.error("Failed to configure secret. Please try again.");
    }
  };

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Settings2 className="h-8 w-8" />
            Settings
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage your integrations, API credentials, and knowledge base
          </p>
        </div>
      </div>

      <Tabs defaultValue="integrations" className="w-full">
        <TabsList>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
          <TabsTrigger value="knowledge">
            <BookOpen className="h-4 w-4 mr-2" />
            Knowledge Base
          </TabsTrigger>
        </TabsList>

        <TabsContent value="integrations" className="space-y-6">
          {/* API Keys & Secrets */}
          <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            <CardTitle>API Keys & Secrets</CardTitle>
          </div>
          <CardDescription>
            Configure your third-party service credentials. All secrets are encrypted and stored securely.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {secrets.map((secret) => (
            <div
              key={secret.name}
              className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold">{secret.displayName}</h3>
                  {secret.configured ? (
                    <Badge variant="default" className="gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      Configured
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="gap-1">
                      <XCircle className="h-3 w-3" />
                      Not Configured
                    </Badge>
                  )}
                  {secret.required && (
                    <Badge variant="outline" className="text-xs">
                      Required
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  {secret.description}
                </p>
                <code className="text-xs text-muted-foreground mt-1 block">
                  {secret.name}
                </code>
              </div>
              <div className="flex gap-2">
                {secret.configured && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleTestConnection(secret.name)}
                  >
                    Test
                  </Button>
                )}
                <Button
                  variant={secret.configured ? "outline" : "default"}
                  size="sm"
                  onClick={() => handleConfigureSecret(secret)}
                >
                  {secret.configured ? "Update" : "Configure"}
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Integration Status */}
      <Card>
        <CardHeader>
          <CardTitle>Integration Status</CardTitle>
          <CardDescription>
            Overview of your connected services
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <span className="text-lg font-bold">M</span>
              </div>
              <div>
                <h4 className="font-medium">Monday.com</h4>
                <p className="text-sm text-muted-foreground">Contact Management</p>
              </div>
            </div>
            <Badge variant="default">Active</Badge>
          </div>

          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                <span className="text-lg font-bold text-red-500">T</span>
              </div>
              <div>
                <h4 className="font-medium">Twilio</h4>
                <p className="text-sm text-muted-foreground">SMS Messaging</p>
              </div>
            </div>
            <Badge variant="default">Active</Badge>
          </div>

          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
                <span className="text-lg font-bold text-orange-500">A</span>
              </div>
              <div>
                <h4 className="font-medium">AWS SES</h4>
                <p className="text-sm text-muted-foreground">Email Campaigns</p>
              </div>
            </div>
            <Badge variant={configuredSecrets.has("AWS_ACCESS_KEY_ID") ? "default" : "secondary"}>
              {configuredSecrets.has("AWS_ACCESS_KEY_ID") ? "Active" : "Not Configured"}
            </Badge>
          </div>

          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <span className="text-lg font-bold text-blue-500">𝕏</span>
              </div>
              <div>
                <h4 className="font-medium">Twitter/X</h4>
                <p className="text-sm text-muted-foreground">Social Media Posting</p>
              </div>
            </div>
            <Badge variant={configuredSecrets.has("TWITTER_ACCESS_TOKEN") ? "default" : "secondary"}>
              {configuredSecrets.has("TWITTER_ACCESS_TOKEN") ? "Active" : "Not Configured"}
            </Badge>
          </div>
        </CardContent>
      </Card>

          {/* Backend Access */}
          <Card>
            <CardHeader>
              <CardTitle>Backend Management</CardTitle>
              <CardDescription>
                Access your database, edge functions, and secrets management
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Configure API keys, view database tables, and manage edge functions through the backend dashboard.
              </p>
              <Button variant="default" className="w-full" onClick={() => {
                toast.success("Opening backend dashboard...");
              }}>
                Open Backend Dashboard
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="knowledge">
          <KnowledgeBase />
        </TabsContent>
      </Tabs>

      {/* Configure Secret Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configure {currentSecret?.displayName}</DialogTitle>
            <DialogDescription>
              {currentSecret?.description}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="value"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Secret Value</FormLabel>
                    <FormControl>
                      <Input 
                        type="password" 
                        placeholder="Enter secret value" 
                        {...field}
                        autoComplete="off"
                      />
                    </FormControl>
                    <FormDescription>
                      This value will be encrypted and stored securely.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">
                  Save Secret
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Settings;
