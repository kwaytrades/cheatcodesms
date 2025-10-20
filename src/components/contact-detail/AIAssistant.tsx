import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, X } from "lucide-react";

export const AIAssistant = () => {
  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">🤖 AI Assistant</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <div className="text-xs text-muted-foreground mb-1">Next Best Action:</div>
          <p className="text-sm">
            "Send VIP upsell SMS. High spender, engaged, ready."
          </p>
        </div>
        
        <div className="text-xs text-muted-foreground">
          Confidence: <span className="font-medium text-foreground">78%</span>
        </div>
        
        <div className="flex gap-2">
          <Button size="sm" className="flex-1">
            <Sparkles className="h-3 w-3 mr-1" />
            Generate
          </Button>
          <Button size="sm" variant="ghost">
            <X className="h-3 w-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
