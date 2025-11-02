import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bot, BarChart3, Settings, Layers } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { AgentTypeIcon } from "@/components/agents/AgentTypeIcon";
import { AgentTypeConfig } from "@/components/agents/AgentTypeConfig";

const agentTypes = [
  { id: "sales_agent", name: "Sam - Sales Agent", description: "Proactive outreach to qualify and convert leads" },
  { id: "customer_service", name: "Casey - Customer Service", description: "Handles inbound support questions and troubleshooting" },
  { id: "influencer_outreach", name: "Ivy - Influencer Outreach", description: "Reaches out to influencers with personalized collaboration proposals" },
  { id: "webinar", name: "Wendi - Webinar Agent", description: "Guides contacts through webinar signup and attendance" },
  { id: "textbook", name: "Thomas - Textbook Agent", description: "Helps with textbook purchase decisions and learning path" },
  { id: "flashcards", name: "Frank - Flashcards Agent", description: "Promotes flashcard usage and learning consistency" },
  { id: "algo_monthly", name: "Adam - Algo Monthly Agent", description: "Nurtures algorithmic trading subscription leads" },
  { id: "ccta", name: "Chris - CCTA Agent", description: "Guides through CCTA certification process" },
  { id: "lead_nurture", name: "Jamie - Lead Nurture Agent", description: "General lead nurturing for undecided prospects" },
];

export default function AIAgentTypes() {
  const navigate = useNavigate();
  const [selectedAgent, setSelectedAgent] = useState(agentTypes[0].id);

  const currentAgent = agentTypes.find(a => a.id === selectedAgent);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Agent Type Configuration</h1>
        <p className="text-muted-foreground">Configure each agent type's behavior, templates, and knowledge base</p>
      </div>

      <Tabs value="types" className="w-full">
        <TabsList>
          <TabsTrigger value="dashboard" onClick={() => navigate("/agents")}>
            <Bot className="w-4 h-4 mr-2" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="analytics" onClick={() => navigate("/agents/analytics")}>
            <BarChart3 className="w-4 h-4 mr-2" />
            Analytics
          </TabsTrigger>
          <TabsTrigger value="types" onClick={() => navigate("/agents/types")}>
            <Layers className="w-4 h-4 mr-2" />
            Agent Types
          </TabsTrigger>
          <TabsTrigger value="settings" onClick={() => navigate("/agents/settings")}>
            <Settings className="w-4 h-4 mr-2" />
            Settings
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="grid grid-cols-[300px_1fr] gap-6">
        {/* Agent Type List */}
        <div className="space-y-2">
          {agentTypes.map((agent) => (
            <Card
              key={agent.id}
              className={`cursor-pointer transition-colors ${
                selectedAgent === agent.id ? "border-primary bg-primary/5" : "hover:bg-muted/50"
              }`}
              onClick={() => setSelectedAgent(agent.id)}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <AgentTypeIcon type={agent.id} className="w-6 h-6" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">{agent.name}</div>
                    <div className="text-xs text-muted-foreground truncate">{agent.description}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Agent Configuration Panel */}
        {currentAgent && (
          <AgentTypeConfig
            agentType={currentAgent.id}
            agentName={currentAgent.name}
            agentDescription={currentAgent.description}
          />
        )}
      </div>
    </div>
  );
}
