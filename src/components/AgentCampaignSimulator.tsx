import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Play, MessageSquare, Mail, Phone } from "lucide-react";
import { toast } from "sonner";

interface AgentCampaignSimulatorProps {
  agentType: string;
}

export function AgentCampaignSimulator({ agentType }: AgentCampaignSimulatorProps) {
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationResults, setSimulationResults] = useState<any>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Mock customer form
  const [customerName, setCustomerName] = useState("Alex Smith");
  const [personalityType, setPersonalityType] = useState("analytical");
  const [engagementLevel, setEngagementLevel] = useState("high");
  const [customerGoals, setCustomerGoals] = useState("Learn technical analysis and improve trading skills");

  const runSimulation = async () => {
    setIsSimulating(true);
    setSimulationResults(null);

    try {
      const { data, error } = await supabase.functions.invoke('simulate-agent-campaign', {
        body: {
          agent_type: agentType,
          mock_customer: {
            name: customerName,
            personality_type: personalityType,
            engagement_level: engagementLevel,
            goals: customerGoals
          }
        }
      });

      if (error) throw error;

      setSimulationResults(data);
      toast.success("Campaign simulation completed!");
    } catch (error: any) {
      console.error('Simulation error:', error);
      toast.error(`Simulation failed: ${error.message}`);
    } finally {
      setIsSimulating(false);
    }
  };

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case 'sms': return <Phone className="h-4 w-4" />;
      case 'email': return <Mail className="h-4 w-4" />;
      default: return <MessageSquare className="h-4 w-4" />;
    }
  };

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full">
          <Play className="mr-2 h-4 w-4" />
          Simulate Full Campaign
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Campaign Simulation - {agentType.replace('_', ' ').toUpperCase()}</DialogTitle>
        </DialogHeader>

        <ScrollArea className="h-[calc(90vh-120px)] pr-4">
          {!simulationResults ? (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Mock Customer Profile</CardTitle>
                  <CardDescription>
                    Configure a test customer to see how campaign messages adapt
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="customerName">Customer Name</Label>
                    <Input
                      id="customerName"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Alex Smith"
                    />
                  </div>

                  <div>
                    <Label htmlFor="personalityType">Personality Type</Label>
                    <Select value={personalityType} onValueChange={setPersonalityType}>
                      <SelectTrigger id="personalityType">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="analytical">Analytical</SelectItem>
                        <SelectItem value="relationship_builder">Relationship Builder</SelectItem>
                        <SelectItem value="results_driven">Results Driven</SelectItem>
                        <SelectItem value="creative">Creative</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="engagementLevel">Engagement Level</Label>
                    <Select value={engagementLevel} onValueChange={setEngagementLevel}>
                      <SelectTrigger id="engagementLevel">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="high">High - Responds frequently</SelectItem>
                        <SelectItem value="medium">Medium - Occasional responses</SelectItem>
                        <SelectItem value="low">Low - Rarely responds</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="customerGoals">Customer Goals</Label>
                    <Input
                      id="customerGoals"
                      value={customerGoals}
                      onChange={(e) => setCustomerGoals(e.target.value)}
                      placeholder="What does this customer want to achieve?"
                    />
                  </div>
                </CardContent>
              </Card>

              <Button
                onClick={runSimulation}
                disabled={isSimulating}
                className="w-full"
                size="lg"
              >
                {isSimulating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Simulating Campaign...
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    Run Campaign Simulation
                  </>
                )}
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Statistics */}
              <Card>
                <CardHeader>
                  <CardTitle>Campaign Statistics</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <div className="text-2xl font-bold text-primary">
                        {simulationResults.statistics.total_messages}
                      </div>
                      <div className="text-sm text-muted-foreground">Total Messages</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-primary">
                        {simulationResults.campaign_duration} days
                      </div>
                      <div className="text-sm text-muted-foreground">Campaign Duration</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-primary">
                        {simulationResults.statistics.avg_message_length}
                      </div>
                      <div className="text-sm text-muted-foreground">Avg Message Length</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-primary">
                        {simulationResults.statistics.conversation_aware_messages}
                      </div>
                      <div className="text-sm text-muted-foreground">Context-Aware</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Message Timeline */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Campaign Timeline</h3>
                  <Button onClick={() => setSimulationResults(null)} variant="outline" size="sm">
                    New Simulation
                  </Button>
                </div>

                {simulationResults.campaign_preview.map((message: any, index: number) => (
                  <Card key={index} className={message.conversation_aware ? "border-primary" : ""}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">
                          Day {message.day} - {message.message_goal}
                        </CardTitle>
                        <div className="flex items-center gap-2">
                          {message.conversation_aware && (
                            <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                              Context-Aware
                            </span>
                          )}
                          <span className="flex items-center gap-1 text-sm text-muted-foreground">
                            {getChannelIcon(message.channel)}
                            {message.channel}
                          </span>
                        </div>
                      </div>
                      <CardDescription>
                        {message.trigger_type.replace('_', ' ')}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div>
                        <div className="text-sm font-medium mb-1">Agent Message:</div>
                        <div className="bg-primary/5 p-3 rounded-md text-sm">
                          {message.message_generated}
                        </div>
                      </div>

                      {message.simulated_customer_reply && (
                        <div>
                          <div className="text-sm font-medium mb-1">Simulated Customer Reply:</div>
                          <div className="bg-secondary/20 p-3 rounded-md text-sm">
                            {message.simulated_customer_reply}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
