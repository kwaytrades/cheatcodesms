import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MessageSquare, Mail, Phone, UserPlus, Tag } from "lucide-react";

export const QuickActions = () => {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">🎯 Quick Actions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <Button variant="outline" size="sm" className="w-full justify-start">
          <MessageSquare className="h-4 w-4 mr-2" />
          Send SMS
        </Button>
        <Button variant="outline" size="sm" className="w-full justify-start">
          <Mail className="h-4 w-4 mr-2" />
          Send Email
        </Button>
        <Button variant="outline" size="sm" className="w-full justify-start">
          <Phone className="h-4 w-4 mr-2" />
          Schedule Call
        </Button>
        <Button variant="outline" size="sm" className="w-full justify-start">
          <UserPlus className="h-4 w-4 mr-2" />
          Hand to Human
        </Button>
        <Button variant="outline" size="sm" className="w-full justify-start">
          <Tag className="h-4 w-4 mr-2" />
          Add Tags
        </Button>
      </CardContent>
    </Card>
  );
};
