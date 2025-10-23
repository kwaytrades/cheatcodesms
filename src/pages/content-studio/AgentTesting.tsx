import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Play, Star, TrendingUp } from "lucide-react";
import { AgentTypeIcon } from "@/components/agents/AgentTypeIcon";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const AGENT_TYPES = [
  { id: "sales_agent", name: "Sam - Sales Agent" },
  { id: "customer_service", name: "Casey - Customer Service" },
  { id: "webinar", name: "Wendi - Webinar Agent" },
  { id: "textbook", name: "Thomas - Textbook Agent" },
  { id: "flashcards", name: "Frank - Flashcards Agent" },
  { id: "algo_monthly", name: "Adam - Algo Monthly Agent" },
  { id: "ccta", name: "Chris - CCTA Agent" },
  { id: "lead_nurture", name: "Jamie - Lead Nurture Agent" },
];

export default function AgentTesting() {
  const navigate = useNavigate();
  const [selectedAgent, setSelectedAgent] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerGoals, setCustomerGoals] = useState("");
  const [customerResponse, setCustomerResponse] = useState("");
  const [conversation, setConversation] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentScore, setCurrentScore] = useState(0);

  const handleStartTest = async () => {
    if (!selectedAgent || !customerName) {
      toast.error("Please select an agent and enter a customer name");
      return;
    }

    setIsLoading(true);
    try {
      // Generate initial message
      const { data, error } = await supabase.functions.invoke('generate-ai-message', {
        body: {
          contact_id: 'test-contact',
          agent_id: 'test-agent',
          message_type: 'introduction',
          trigger_context: {
            test_mode: true,
            customer_name: customerName,
            customer_goals: customerGoals,
          },
        },
      });

      if (error) throw error;

      setConversation([
        {
          role: 'agent',
          message: data.message.message,
          timestamp: new Date(),
          chunks_used: data.chunks_used || [],
        },
      ]);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendResponse = async () => {
    if (!customerResponse.trim()) return;

    const newMessage = {
      role: 'customer',
      message: customerResponse,
      timestamp: new Date(),
    };

    setConversation([...conversation, newMessage]);
    setCustomerResponse("");
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('generate-ai-message', {
        body: {
          contact_id: 'test-contact',
          agent_id: 'test-agent',
          message_type: 'check_in',
          trigger_context: {
            test_mode: true,
            conversation_history: conversation,
            last_customer_message: customerResponse,
          },
        },
      });

      if (error) throw error;

      setConversation(prev => [
        ...prev,
        {
          role: 'agent',
          message: data.message.message,
          timestamp: new Date(),
          chunks_used: data.chunks_used || [],
        },
      ]);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleScoreMessage = async (messageIndex: number, score: number) => {
    setCurrentScore(score);
    
    try {
      await supabase.from('agent_test_results').insert({
        agent_type: selectedAgent,
        test_scenario: {
          customer_name: customerName,
          customer_goals: customerGoals,
        },
        messages: conversation,
        accuracy_score: score,
        knowledge_chunks_used: conversation[messageIndex].chunks_used,
        tester_notes: `Message ${messageIndex + 1} scored ${score}/5`,
      });

      toast.success("Score recorded");
    } catch (error: any) {
      toast.error("Failed to save score");
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/agents')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Agent Testing Lab</h1>
            <p className="text-muted-foreground">Test and evaluate AI agent accuracy with custom scenarios</p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="simulator" className="space-y-6">
        <TabsList>
          <TabsTrigger value="simulator">Conversation Simulator</TabsTrigger>
          <TabsTrigger value="results">Test Results</TabsTrigger>
        </TabsList>

        <TabsContent value="simulator" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Setup Test Scenario</CardTitle>
              <CardDescription>Configure the agent and customer profile</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Select Agent to Test</Label>
                <Select value={selectedAgent} onValueChange={setSelectedAgent}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose an agent" />
                  </SelectTrigger>
                  <SelectContent>
                    {AGENT_TYPES.map((agent) => (
                      <SelectItem key={agent.id} value={agent.id}>
                        <div className="flex items-center gap-2">
                          <AgentTypeIcon type={agent.id} />
                          <span>{agent.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Customer Name</Label>
                <Input
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="John Doe"
                />
              </div>

              <div className="space-y-2">
                <Label>Customer Goals</Label>
                <Textarea
                  value={customerGoals}
                  onChange={(e) => setCustomerGoals(e.target.value)}
                  placeholder="Wants to learn options trading, concerned about risk..."
                  rows={3}
                />
              </div>

              <Button onClick={handleStartTest} disabled={isLoading} className="w-full">
                <Play className="mr-2 h-4 w-4" />
                Start Test Conversation
              </Button>
            </CardContent>
          </Card>

          {conversation.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Conversation</CardTitle>
                <CardDescription>Simulate customer responses and rate agent accuracy</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {conversation.map((msg, idx) => (
                  <div key={idx} className={`space-y-2 p-4 rounded-lg ${msg.role === 'agent' ? 'bg-primary/5' : 'bg-muted'}`}>
                    <div className="flex items-center justify-between">
                      <Badge variant={msg.role === 'agent' ? 'default' : 'secondary'}>
                        {msg.role === 'agent' ? 'Agent' : 'Customer'}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {msg.timestamp.toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-sm">{msg.message}</p>
                    
                    {msg.role === 'agent' && (
                      <div className="flex items-center gap-2 pt-2">
                        <span className="text-xs text-muted-foreground">Rate accuracy:</span>
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Button
                            key={star}
                            variant="ghost"
                            size="sm"
                            onClick={() => handleScoreMessage(idx, star)}
                          >
                            <Star className={`h-4 w-4 ${star <= currentScore ? 'fill-yellow-400 text-yellow-400' : ''}`} />
                          </Button>
                        ))}
                      </div>
                    )}

                    {msg.chunks_used && msg.chunks_used.length > 0 && (
                      <div className="text-xs text-muted-foreground pt-2">
                        <span className="font-medium">Knowledge chunks used: {msg.chunks_used.length}</span>
                      </div>
                    )}
                  </div>
                ))}

                <div className="flex gap-2">
                  <Input
                    value={customerResponse}
                    onChange={(e) => setCustomerResponse(e.target.value)}
                    placeholder="Type customer response..."
                    onKeyPress={(e) => e.key === 'Enter' && handleSendResponse()}
                    disabled={isLoading}
                  />
                  <Button onClick={handleSendResponse} disabled={isLoading || !customerResponse.trim()}>
                    Send
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="results">
          <Card>
            <CardHeader>
              <CardTitle>Test Results</CardTitle>
              <CardDescription>Historical test performance data</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <div className="text-center space-y-2">
                  <TrendingUp className="h-12 w-12 mx-auto opacity-50" />
                  <p>No test results yet</p>
                  <p className="text-sm">Run some tests to see performance metrics</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
