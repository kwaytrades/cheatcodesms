import { Mail, Phone, MapPin, User } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface ContactQuickInfoProps {
  contact: {
    full_name: string;
    email?: string;
    phone_number?: string;
    first_name?: string;
  };
}

export const ContactQuickInfo = ({ contact }: ContactQuickInfoProps) => {
  const initials = contact.first_name?.[0] || contact.full_name?.[0] || "?";
  
  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex flex-col items-center text-center space-y-2">
          <Avatar className="h-16 w-16">
            <AvatarFallback className="text-lg">{initials}</AvatarFallback>
          </Avatar>
          <h3 className="font-semibold text-lg">{contact.full_name}</h3>
        </div>
        
        <div className="space-y-2 text-sm">
          {contact.email && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Mail className="h-4 w-4 shrink-0" />
              <span className="truncate">{contact.email}</span>
            </div>
          )}
          {contact.phone_number && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Phone className="h-4 w-4 shrink-0" />
              <span>{contact.phone_number}</span>
            </div>
          )}
        </div>
        
        <Button variant="outline" size="sm" className="w-full">
          Edit Profile
        </Button>
      </CardContent>
    </Card>
  );
};
