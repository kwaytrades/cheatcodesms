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
  // Fetch active agent for this contact - check help mode and product agents
  const { data: activeAgent } = useQuery({
    queryKey: ['active-agent', contactId],
    queryFn: async () => {
      if (!contactId) return null;
      
      // First check if help mode is active (customer service priority)
      const { data: convState } = await supabase
        .from('conversation_state')
        .select('help_mode_until, active_agent_id')
        .eq('contact_id', contactId)
        .maybeSingle();
      
      // If help mode is active, customer service takes priority
      if (convState?.help_mode_until) {
        const helpModeUntil = new Date(convState.help_mode_until);
        if (helpModeUntil > new Date()) {
          return {
            type: 'help_mode' as const,
            agent_type: 'customer_service',
            help_mode_until: convState.help_mode_until
          };
        }
      }
      
      // Check for assigned product agent
      const { data: productAgent } = await supabase
        .from('product_agents')
        .select('*')
        .eq('contact_id', contactId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (productAgent) {
        const now = new Date();
        const expirationDate = productAgent.expiration_date ? new Date(productAgent.expiration_date) : null;
        const isExpired = expirationDate && now > expirationDate;
        
        if (!isExpired) {
          return {
            type: 'product_agent' as const,
            agent_type: productAgent.product_type,
            ...productAgent
          };
        }
      }
      
      // Check for active agent conversation (textbook, etc.)
      const { data: convAgent } = await supabase
        .from('agent_conversations')
        .select('*')
        .eq('contact_id', contactId)
        .eq('status', 'active')
        .order('last_message_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (convAgent) {
        const now = new Date();
        const expirationDate = convAgent.expiration_date ? new Date(convAgent.expiration_date) : null;
        const isExpired = expirationDate && now > expirationDate;
        
        if (!isExpired) {
          return {
            type: 'agent_conversation' as const,
            agent_type: convAgent.agent_type,
            ...convAgent
          };
        }
      }
      
      // No active agent - return null (don't default to customer service)
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
                <AgentTypeIcon type={activeAgent.agent_type} className="w-4 h-4" />
                <span className="text-sm font-medium">
                  {AGENT_NAMES[activeAgent.agent_type] || activeAgent.agent_type} 
                  <span className="text-muted-foreground ml-1">
                    ({activeAgent.agent_type.replace(/_/g, ' ')})
                  </span>
                  {activeAgent.type === 'help_mode' && (
                    <span className="ml-2 text-xs text-amber-600">
                      (Help Mode - expires {new Date(activeAgent.help_mode_until).toLocaleTimeString()})
                    </span>
                  )}
                </span>
              </div>
            ) : (
              <span className="text-sm text-muted-foreground italic">No active agent</span>
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
