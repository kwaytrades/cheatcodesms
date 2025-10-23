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
    const insights: string[] = [];

    // Purchase patterns
    if (purchases.length > 0) {
      const sortedPurchases = [...purchases].sort((a, b) => 
        new Date(b.purchase_date).getTime() - new Date(a.purchase_date).getTime()
      );
      const lastPurchase = sortedPurchases[0];
      const daysSinceLastPurchase = Math.floor(
        (Date.now() - new Date(lastPurchase.purchase_date).getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysSinceLastPurchase <= 30) {
        insights.push(`Recent buyer - last purchase ${daysSinceLastPurchase} days ago`);
      } else if (daysSinceLastPurchase > 90) {
        insights.push(`⚠️ No purchase in ${daysSinceLastPurchase} days - re-engagement opportunity`);
      }

      if (purchases.length >= 3) {
        insights.push(`Repeat customer with ${purchases.length} purchases`);
      }

      // Check for patterns in purchase timing
      const purchaseDates = purchases.map(p => new Date(p.purchase_date));
      const intervals = purchaseDates.slice(0, -1).map((date, i) => 
        Math.abs(date.getTime() - purchaseDates[i + 1].getTime()) / (1000 * 60 * 60 * 24)
      );
      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      if (avgInterval && !isNaN(avgInterval)) {
        insights.push(`Typical purchase cycle: ~${Math.round(avgInterval)} days`);
      }
    } else {
      insights.push("No purchases yet - warm lead for first conversion");
    }

    // Products owned
    if (contact?.products_owned && contact.products_owned.length > 0) {
      const productList = contact.products_owned.slice(0, 2).join(', ');
      insights.push(`Owns: ${productList}${contact.products_owned.length > 2 ? ` +${contact.products_owned.length - 2} more` : ''}`);
    }

    // Communication patterns
    const allMessages = [...messages, ...aiMessages];
    if (allMessages.length > 0) {
      const emailMessages = aiMessages.filter(m => m.channel === 'email');
      const smsMessages = messages.length + aiMessages.filter(m => m.channel === 'sms').length;
      
      if (emailMessages.length > 0 && smsMessages > 0) {
        const emailEngagement = emailMessages.filter(m => m.opened || m.replied).length;
        const emailRate = Math.round((emailEngagement / emailMessages.length) * 100);
        insights.push(`Email engagement: ${emailRate}%`);
      }

      const recentMessages = allMessages.slice(0, 5);
      const lastMessage = recentMessages[0];
      if (lastMessage?.created_at) {
        insights.push(`Last contacted ${formatDistanceToNow(new Date(lastMessage.created_at), { addSuffix: true })}`);
      }
    } else {
      insights.push("No communication history - cold start");
    }

    // Engagement level
    if (contact?.engagement_score !== undefined) {
      if (contact.engagement_score > 70) {
        insights.push("🔥 Highly engaged - ready for upsell");
      } else if (contact.engagement_score < 30) {
        insights.push("❄️ Low engagement - needs nurturing campaign");
      }
    }

    // Chargeback warning
    if (contact?.has_disputed) {
      insights.push(`⚠️ SHITLIST - $${contact.disputed_amount || 0} disputed`);
    }

    // Customer tier insights
    if (contact?.customer_tier === 'VIP') {
      insights.push("👑 VIP customer - high priority");
    } else if (contact?.customer_tier?.startsWith('Level')) {
      insights.push(`Active ${contact.customer_tier} customer`);
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