import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings as SettingsIcon } from "lucide-react";

export default function Settings() {
  return (
    <div className="p-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <SettingsIcon className="h-5 w-5" />
            <CardTitle>Settings & Configuration</CardTitle>
          </div>
          <CardDescription>Configure Cheat Code AI agent settings and parameters</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <SettingsIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Agent Configuration</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Configuration options for subscription tiers, agent prompts, market data settings,
              credit management, and integration settings will be available here.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
