import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SMSChatView } from "./SMSChatView";
import { EmailHistoryView } from "./EmailHistoryView";
import { TimelineView } from "./TimelineView";
import { MessageComposer } from "./MessageComposer";

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
}

export const CommunicationTabs = ({
  messages,
  emails,
  timeline,
  onSendMessage
}: CommunicationTabsProps) => {
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
        
        <TabsContent value="sms" className="flex-1 mt-0">
          <SMSChatView messages={messages} />
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
