import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Send, Trash2 } from "lucide-react";
import { AgentTypeIcon } from "@/components/agents/AgentTypeIcon";
import { AgentNameBadge } from "@/components/agents/AgentNameBadge";
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

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export default function AgentTesting() {
  const navigate = useNavigate();
  const [selectedAgent, setSelectedAgent] = useState("");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Initialize test conversation on mount
  useEffect(() => {
    const initTestConversation = async () => {
      try {
        // Check if test conversation exists in agent_conversations
        const { data: existingConv, error: fetchError } = await supabase
          .from('agent_conversations')
          .select('id')
          .eq('contact_id', 'test-contact-id')
          .eq('agent_type', 'customer_service')
          .maybeSingle();

        if (fetchError) throw fetchError;

        if (existingConv) {
          setConversationId(existingConv.id);
          // Load existing messages
          const { data: messagesData } = await supabase
            .from('agent_messages')
            .select('*')
            .eq('conversation_id', existingConv.id)
            .order('created_at', { ascending: true });
          
          if (messagesData && messagesData.length > 0) {
            const formattedMessages = messagesData.map(msg => ({
              role: msg.role === 'user' ? 'user' : 'assistant',
              content: msg.content,
              timestamp: new Date(msg.created_at)
            }));
            setMessages(formattedMessages as Message[]);
          }
        } else {
          // Create new test conversation
          const { data: newConv, error: insertError } = await supabase
            .from('agent_conversations')
            .insert([{
              contact_id: 'test-contact-id',
              agent_type: 'customer_service',
              status: 'active',
              started_at: new Date().toISOString()
            }])
            .select('id')
            .single();

          if (insertError) throw insertError;
          if (newConv) setConversationId(newConv.id);
        }
      } catch (error) {
        console.error('Error initializing test conversation:', error);
        toast.error('Failed to initialize test conversation');
      }
    };

    initTestConversation();
  }, []);

  const handleSend = async () => {
    if (!input.trim() || !selectedAgent) {
      if (!selectedAgent) {
        toast.error("Please select an agent first");
      }
      return;
    }

    const userMessage: Message = {
      role: "user",
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('agent-chat', {
        body: {
          contactId: 'test-contact-id',
          agentType: selectedAgent,
          message: input.trim(),
          conversationId: conversationId || undefined,
        },
      });

      if (error) throw error;

      const assistantMessage: Message = {
        role: "assistant",
        content: data.response,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
      
      // Update conversation ID if it was created
      if (data.conversationId && !conversationId) {
        setConversationId(data.conversationId);
      }
    } catch (error: any) {
      console.error('Error:', error);
      
      // Handle specific error types
      if (error.message?.includes('Rate limit')) {
        toast.error('Too many requests. Please wait a moment and try again.');
      } else if (error.message?.includes('Payment required') || error.message?.includes('AI service')) {
        toast.error('AI service unavailable. Please contact support.');
      } else {
        toast.error(error.message || "Failed to get response");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleNewChat = () => {
    setMessages([]);
    setInput("");
  };

  const handleClearHistory = async () => {
    if (!conversationId) return;
    
    try {
      const { error } = await supabase
        .from('agent_messages')
        .delete()
        .eq('conversation_id', conversationId);
      
      if (error) throw error;
      
      setMessages([]);
      toast.success('Conversation history cleared');
    } catch (error) {
      console.error('Error clearing history:', error);
      toast.error('Failed to clear history');
    }
  };

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="container mx-auto p-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/agents')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Agent Testing Lab</h1>
              <p className="text-sm text-muted-foreground">Test AI agents in real-time</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Select value={selectedAgent} onValueChange={setSelectedAgent}>
              <SelectTrigger className="w-[280px]">
                <SelectValue placeholder="Select an agent to test" />
              </SelectTrigger>
              <SelectContent>
                {AGENT_TYPES.map((agent) => (
                  <SelectItem key={agent.id} value={agent.id}>
                    <div className="flex items-center gap-2">
                      <AgentTypeIcon type={agent.id} className="w-4 h-4" />
                      <span>{agent.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={handleNewChat}>
              New Chat
            </Button>
            <Button variant="outline" onClick={handleClearHistory} disabled={messages.length === 0}>
              <Trash2 className="h-4 w-4 mr-2" />
              Clear History
            </Button>
          </div>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full max-w-4xl mx-auto flex flex-col">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {messages.length === 0 ? (
              <div className="h-full flex items-center justify-center">
                <div className="text-center space-y-4">
                  {selectedAgent ? (
                    <>
                      <div className="flex justify-center">
                        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                          <AgentTypeIcon type={selectedAgent} className="w-8 h-8" />
                        </div>
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold mb-1">
                          <AgentNameBadge agentType={selectedAgent} />
                        </h3>
                        <p className="text-muted-foreground">
                          Start a conversation to test this agent
                        </p>
                      </div>
                    </>
                  ) : (
                    <p className="text-muted-foreground">
                      Select an agent above to start testing
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <>
                {messages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex gap-4 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    {msg.role === "assistant" && selectedAgent && (
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <AgentTypeIcon type={selectedAgent} className="w-5 h-5" />
                      </div>
                    )}
                    <div
                      className={`max-w-[70%] rounded-2xl px-4 py-3 ${
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                      <span className="text-xs opacity-70 mt-2 block">
                        {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    {msg.role === "user" && (
                      <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
                        <span className="text-sm font-semibold">U</span>
                      </div>
                    )}
                  </div>
                ))}
                {isLoading && (
                  <div className="flex gap-4 justify-start">
                    {selectedAgent && (
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <AgentTypeIcon type={selectedAgent} className="w-5 h-5" />
                      </div>
                    )}
                    <div className="bg-muted rounded-2xl px-4 py-3">
                      <div className="flex gap-1">
                        <div className="w-2 h-2 rounded-full bg-foreground/40 animate-bounce" style={{ animationDelay: "0ms" }} />
                        <div className="w-2 h-2 rounded-full bg-foreground/40 animate-bounce" style={{ animationDelay: "150ms" }} />
                        <div className="w-2 h-2 rounded-full bg-foreground/40 animate-bounce" style={{ animationDelay: "300ms" }} />
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* Input Area */}
          <div className="border-t bg-card p-4">
            <div className="flex gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={selectedAgent ? "Type your message..." : "Select an agent first..."}
                disabled={isLoading || !selectedAgent}
                className="flex-1"
              />
              <Button
                onClick={handleSend}
                disabled={isLoading || !input.trim() || !selectedAgent}
                size="icon"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2 text-center">
              Press Enter to send, Shift+Enter for new line
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}