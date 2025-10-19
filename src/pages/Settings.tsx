import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Settings2, Key, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";

interface SecretConfig {
  name: string;
  displayName: string;
  description: string;
  required: boolean;
  configured: boolean;
}

const Settings = () => {
  // These would ideally come from backend but for now we'll track them manually
  const secrets: SecretConfig[] = [
    {
      name: "MONDAY_API_KEY",
      displayName: "Monday.com API Key",
      description: "Required for syncing contacts from Monday.com boards",
      required: true,
      configured: true // We know this exists from context
    },
    {
      name: "TWILIO_ACCOUNT_SID",
      displayName: "Twilio Account SID",
      description: "Your Twilio account identifier for SMS functionality",
      required: true,
      configured: true
    },
    {
      name: "TWILIO_AUTH_TOKEN",
      displayName: "Twilio Auth Token",
      description: "Authentication token for Twilio API access",
      required: true,
      configured: false
    },
    {
      name: "TWILIO_PHONE_NUMBER",
      displayName: "Twilio Phone Number",
      description: "The phone number to send SMS from (format: +1234567890)",
      required: true,
      configured: false
    }
  ];

  const handleConfigureSecret = (secretName: string) => {
    // Open backend dashboard for secret configuration
    window.open('#', '_blank');
    toast.info(`Opening backend to configure ${secretName}...`);
  };

  const handleTestConnection = (secretName: string) => {
    toast.info(`Testing connection for ${secretName}...`);
    // This would test the API connection
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
            Manage your integrations and API credentials
          </p>
        </div>
      </div>

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
                  onClick={() => handleConfigureSecret(secret.name)}
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
            <Badge variant="secondary">Inactive</Badge>
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
    </div>
  );
};

export default Settings;
