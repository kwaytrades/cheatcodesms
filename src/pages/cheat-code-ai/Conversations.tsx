import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageSquare } from "lucide-react";

export default function Conversations() {
  return (
    <div className="p-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            <CardTitle>Conversations</CardTitle>
          </div>
          <CardDescription>View and manage conversations with Cheat Code AI users</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Conversations View</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              The conversation interface will show all SMS exchanges between users and the Trade Analysis Agent.
              This feature is coming soon.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
