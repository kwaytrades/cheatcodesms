import { AutomationTriggersManager } from "@/components/AutomationTriggersManager";
import { AgentCampaignConfigEditor } from "@/components/AgentCampaignConfigEditor";
import { AgentCampaignSimulator } from "@/components/AgentCampaignSimulator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bot } from "lucide-react";

const AutomationTriggers = () => {
  const [selectedAgentType, setSelectedAgentType] = useState("textbook");

  const agentTypes = [
    { id: "textbook", name: "Textbook Agent", duration: "90 days" },
    { id: "algo_monthly", name: "Algo Monthly", duration: "60 days" },
    { id: "sales_agent", name: "Sales Agent", duration: "30 days" },
    { id: "customer_service", name: "Customer Service", duration: "30 days" },
    { id: "lead_nurture", name: "Lead Nurture", duration: "30 days" },
  ];

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Automation Center</h1>
        <p className="text-muted-foreground">
          Configure agent campaigns and automation triggers
        </p>
      </div>

      <Tabs defaultValue="campaigns" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="campaigns">Agent Campaigns</TabsTrigger>
          <TabsTrigger value="triggers">Legacy Triggers</TabsTrigger>
        </TabsList>

        <TabsContent value="campaigns" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bot className="h-5 w-5" />
                Select Agent Type
              </CardTitle>
              <CardDescription>
                Configure campaign schedules for each agent type
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Select value={selectedAgentType} onValueChange={setSelectedAgentType}>
                <SelectTrigger className="w-full max-w-md">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {agentTypes.map((agent) => (
                    <SelectItem key={agent.id} value={agent.id}>
                      <div className="flex items-center justify-between w-full">
                        <span>{agent.name}</span>
                        <span className="text-xs text-muted-foreground ml-4">
                          {agent.duration}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Test Campaign</CardTitle>
                <CardDescription>
                  Preview all messages for this agent's campaign with a simulated customer
                </CardDescription>
              </CardHeader>
              <CardContent>
                <AgentCampaignSimulator agentType={selectedAgentType} />
              </CardContent>
            </Card>
            
            <AgentCampaignConfigEditor agentType={selectedAgentType} />
          </TabsContent>

        <TabsContent value="triggers" className="mt-6">
          <AutomationTriggersManager />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AutomationTriggers;
