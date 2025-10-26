import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format, formatDistanceToNow } from "date-fns";

interface InsightsPanelProps {
  contact?: any;
  purchases?: any[];
  messages?: any[];
  aiMessages?: any[];
}

export const InsightsPanel = ({ contact, purchases = [], messages = [], aiMessages = [] }: InsightsPanelProps) => {
  // Generate dynamic insights based on contact data
  const generateInsights = () => {
    // Try to use cached customer profile first
    if (contact?.customer_profile?.financial) {
      const profile = contact.customer_profile;
      const insights: string[] = [];

      // Financial insights
      if (profile.financial.productsCount > 0) {
        insights.push(`Total purchases: ${profile.financial.productsCount} products ($${profile.financial.totalSpent.toLocaleString()})`);
        const productList = profile.financial.productsOwned.slice(0, 2).join(', ');
        insights.push(`Owns: ${productList}${profile.financial.productsCount > 2 ? ` +${profile.financial.productsCount - 2} more` : ''}`);
      } else {
        insights.push("No purchase history");
      }

      // Communication patterns
      const totalMessages = messages.length + aiMessages.length;
      if (totalMessages > 0) {
        insights.push(`${totalMessages} total communications`);
        
        const recentMessages = [...messages, ...aiMessages]
          .sort((a, b) => new Date(b.created_at || b.sent_at).getTime() - new Date(a.created_at || a.sent_at).getTime())
          .slice(0, 3);
        
        if (recentMessages.length > 0) {
          const lastMessageDate = recentMessages[0].created_at || recentMessages[0].sent_at;
          insights.push(`Last message: ${formatDistanceToNow(new Date(lastMessageDate), { addSuffix: true })}`);
        }
      }

      // Notes
      if (contact?.notes) {
        const notePreview = contact.notes.length > 50 
          ? contact.notes.substring(0, 50) + '...' 
          : contact.notes;
        insights.push(`Note: ${notePreview}`);
      }

      // Tags
      if (profile.behavioral.regularTags && profile.behavioral.regularTags.length > 0) {
        insights.push(`Tags: ${profile.behavioral.regularTags.join(', ')}`);
      }

      // Engagement level
      if (profile.engagement.engagementScore !== undefined) {
        if (profile.engagement.engagementScore > 70) {
          insights.push("🔥 Highly engaged - ready for upsell");
        } else if (profile.engagement.engagementScore < 30) {
          insights.push("❄️ Low engagement - needs nurturing campaign");
        }
      }

      // Chargeback warning
      if (profile.financial.hasDisputed) {
        insights.push(`⚠️ SHITLIST - $${profile.financial.disputedAmount || 0} disputed`);
      }

      // Customer tier insights
      if (profile.financial.tier === 'VIP') {
        insights.push("👑 VIP customer - high priority");
      } else if (profile.financial.tier?.startsWith('Level')) {
        insights.push(`Active ${profile.financial.tier} customer`);
      }

      return insights;
    }

    // Fallback to old logic if profile not cached
    const insights: string[] = [];
    const hasPurchases = (contact?.products_owned && contact.products_owned.length > 0) 
                         || (contact?.total_spent && contact.total_spent > 0);
    
    if (hasPurchases) {
      const totalSpent = contact?.total_spent || 0;
      const productCount = contact?.products_owned?.length || 0;
      insights.push(`Total purchases: ${productCount} products ($${totalSpent.toLocaleString()})`);
    } else {
      insights.push("No purchase history");
    }

    if (contact?.products_owned && contact.products_owned.length > 0) {
      const productList = contact.products_owned.slice(0, 2).join(', ');
      insights.push(`Owns: ${productList}${contact.products_owned.length > 2 ? ` +${contact.products_owned.length - 2} more` : ''}`);
    }

    return insights;
  };

  const insights = generateInsights();

  if (insights.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">💡 Insights</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2 text-sm text-muted-foreground">
          {insights.map((insight, index) => (
            <li key={index} className="flex items-start gap-2">
              <span>•</span>
              <span>{insight}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
};