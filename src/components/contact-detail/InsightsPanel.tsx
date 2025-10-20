import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const InsightsPanel = () => {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">💡 Insights</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li className="flex items-start gap-2">
            <span>•</span>
            <span>Responds best 7-10pm ET</span>
          </li>
          <li className="flex items-start gap-2">
            <span>•</span>
            <span>Prefers SMS over email (86% vs 62%)</span>
          </li>
          <li className="flex items-start gap-2">
            <span>•</span>
            <span>Opens emails within 2 hours</span>
          </li>
          <li className="flex items-start gap-2">
            <span>•</span>
            <span>Waits for sales (all purchases during promos)</span>
          </li>
        </ul>
      </CardContent>
    </Card>
  );
};
