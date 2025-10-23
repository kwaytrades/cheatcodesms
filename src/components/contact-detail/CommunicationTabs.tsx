import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SMSChatView } from "./SMSChatView";
import { EmailHistoryView } from "./EmailHistoryView";
import { TimelineView } from "./TimelineView";
import { MessageComposer } from "./MessageComposer";
import { AgentTypeIcon } from "@/components/agents/AgentTypeIcon";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface Message {
  id: string;
  body: string;
  created_at: string;
  direction: string;
  sender: string;
}

interface AIMessage {
  id: string;
  subject?: string;
  message_body: string;
  sent_at: string;
  opened: boolean;
  replied: boolean;
  channel: string;
}

interface TimelineEvent {
  id: string;
  type: "message" | "email" | "purchase" | "status_change";
  title: string;
  description?: string;
  timestamp: string;
}

interface CommunicationTabsProps {
  messages: Message[];
  emails: AIMessage[];
  timeline: TimelineEvent[];
  onSendMessage?: (message: string) => void;
  contactId?: string;
}

export const CommunicationTabs = ({
  messages,
  emails,
  timeline,
  onSendMessage,
  contactId
}: CommunicationTabsProps) => {
  // Fetch active agent for this contact
  const { data: activeAgent } = useQuery({
    queryKey: ['active-agent', contactId],
    queryFn: async () => {
      if (!contactId) return null;
      
      const { data: convState } = await supabase
        .from('conversation_state')
        .select('active_agent_id, product_agents!conversation_state_active_agent_id_fkey(*)')
        .eq('contact_id', contactId)
        .maybeSingle();
      
      if (convState?.active_agent_id && convState.product_agents) {
        const agent = convState.product_agents;
        const now = new Date();
        const expirationDate = new Date(agent.expiration_date);
        const isExpired = now > expirationDate;
        const isActive = agent.status === 'active';
        
        if (isActive && !isExpired) {
          return agent;
        }
      }
      return null;
    },
    enabled: !!contactId
  });

  const AGENT_NAMES: Record<string, string> = {
    webinar: 'Wendi',
    textbook: 'Thomas',
    flashcards: 'Frank',
    algo_monthly: 'Adam',
    ccta: 'Chris',
    lead_nurture: 'Jamie',
    sales_agent: 'Sam',
    customer_service: 'Casey',
  };

  return (
    <div className="flex flex-col h-full">
      <Tabs defaultValue="sms" className="flex-1 flex flex-col">
        <TabsList className="w-full justify-start rounded-none border-b bg-transparent p-0">
          <TabsTrigger value="sms" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary">
            SMS/Chat
          </TabsTrigger>
          <TabsTrigger value="email" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary">
            Email
          </TabsTrigger>
          <TabsTrigger value="timeline" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary">
            Timeline
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="sms" className="flex-1 mt-0 flex flex-col">
          {/* Active Agent Indicator */}
          <div className="px-4 py-2 bg-muted/50 border-b flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Active Agent:</span>
            {activeAgent ? (
              <div className="flex items-center gap-2">
                <AgentTypeIcon type={activeAgent.product_type} className="w-4 h-4" />
                <span className="text-sm font-medium">
                  {AGENT_NAMES[activeAgent.product_type] || activeAgent.product_type} 
                  <span className="text-muted-foreground ml-1">
                    ({activeAgent.product_type.replace(/_/g, ' ')})
                  </span>
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <AgentTypeIcon type="customer_service" className="w-4 h-4" />
                <span className="text-sm font-medium">Customer Service (Casey)</span>
              </div>
            )}
          </div>
          <div className="flex-1">
            <SMSChatView messages={messages} />
          </div>
        </TabsContent>
        
        <TabsContent value="email" className="flex-1 mt-0">
          <EmailHistoryView emails={emails} />
        </TabsContent>
        
        <TabsContent value="timeline" className="flex-1 mt-0">
          <TimelineView events={timeline} />
        </TabsContent>
      </Tabs>
      
      <MessageComposer onSend={onSendMessage} />
    </div>
  );
};
