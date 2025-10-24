import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { TestTube2, Send, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata?: {
    intent?: string;
    confidence?: number;
    entities?: Record<string, any>;
    handler?: string;
  };
}

export default function Testing() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [persona, setPersona] = useState("beginner");
  const [isLoading, setIsLoading] = useState(false);

  const testScenarios = [
    { label: "Analyze AAPL", message: "analyze AAPL" },
    { label: "Add to watchlist", message: "add TSLA to my watchlist target 250 stop 200" },
    { label: "Check credits", message: "how many credits do I have left?" },
    { label: "Off-topic question", message: "what's the weather today?" },
    { label: "Educational question", message: "what is RSI?" },
    { label: "Multi-ticker", message: "analyze AAPL and TSLA" },
  ];

  const handleSendMessage = async () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      role: 'user',
      content: input
    };

    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      // Call the classify-intent edge function
      const { data: intentData, error: intentError } = await supabase.functions.invoke('classify-intent', {
        body: { message: input }
      });

      if (intentError) throw intentError;

      const assistantMessage: Message = {
        role: 'assistant',
        content: `Intent classified: ${intentData.intent}\nConfidence: ${intentData.confidence}\nEntities: ${JSON.stringify(intentData.entities, null, 2)}`,
        metadata: {
          intent: intentData.intent,
          confidence: intentData.confidence,
          entities: intentData.entities,
          handler: intentData.intent
        }
      };

      setMessages(prev => [...prev, assistantMessage]);
      toast.success(`Intent: ${intentData.intent} (${Math.round(intentData.confidence * 100)}%)`);
    } catch (error: any) {
      console.error('Error testing message:', error);
      toast.error(error.message || 'Failed to process message');
    } finally {
      setIsLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([]);
    toast.success('Chat cleared');
  };

  const loadScenario = (message: string) => {
    setInput(message);
  };

  return (
    <div className="p-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Panel - Test Configuration */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <TestTube2 className="h-5 w-5" />
                <CardTitle>Test Configuration</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Test Persona</label>
                <Select value={persona} onValueChange={setPersona}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="beginner">Beginner Trader</SelectItem>
                    <SelectItem value="intermediate">Intermediate Trader</SelectItem>
                    <SelectItem value="advanced">Advanced Trader</SelectItem>
                    <SelectItem value="professional">Professional Trader</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Quick Test Scenarios</label>
                <div className="space-y-2">
                  {testScenarios.map((scenario, index) => (
                    <Button
                      key={index}
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => loadScenario(scenario.message)}
                    >
                      {scenario.label}
                    </Button>
                  ))}
                </div>
              </div>

              <Button variant="destructive" className="w-full" onClick={clearChat}>
                <Trash2 className="h-4 w-4 mr-2" />
                Clear Chat
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Right Panel - Chat Interface */}
        <div className="lg:col-span-2">
          <Card className="h-[calc(100vh-12rem)] flex flex-col">
            <CardHeader>
              <CardTitle>Testing Center</CardTitle>
              <CardDescription>
                Test the Cheat Code AI agent with different scenarios and messages
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col">
              <div className="flex-1 overflow-y-auto space-y-4 mb-4">
                {messages.length === 0 ? (
                  <div className="text-center text-muted-foreground py-12">
                    <TestTube2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Start testing by sending a message or selecting a quick scenario</p>
                  </div>
                ) : (
                  messages.map((message, index) => (
                    <div
                      key={index}
                      className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-lg p-4 ${
                          message.role === 'user'
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted'
                        }`}
                      >
                        <div className="text-sm whitespace-pre-wrap">{message.content}</div>
                        {message.metadata && (
                          <div className="mt-3 pt-3 border-t border-border/50 space-y-2">
                            {message.metadata.intent && (
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-medium">Intent:</span>
                                <Badge variant="secondary" className="text-xs">
                                  {message.metadata.intent}
                                </Badge>
                              </div>
                            )}
                            {message.metadata.confidence !== undefined && (
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-medium">Confidence:</span>
                                <span className="text-xs">{Math.round(message.metadata.confidence * 100)}%</span>
                              </div>
                            )}
                            {message.metadata.entities && Object.keys(message.metadata.entities).length > 0 && (
                              <div>
                                <span className="text-xs font-medium block mb-1">Entities:</span>
                                <div className="flex flex-wrap gap-1">
                                  {Object.entries(message.metadata.entities).map(([key, value]) => (
                                    <Badge key={key} variant="outline" className="text-xs">
                                      {key}: {String(value)}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="flex gap-2">
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Type a test message..."
                  className="resize-none"
                  rows={3}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                />
                <Button 
                  onClick={handleSendMessage} 
                  disabled={isLoading || !input.trim()}
                  size="lg"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
