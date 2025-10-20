import { useParams, useNavigate } from "react-router-dom";
import { ContactDetailPanel } from "@/components/ContactDetailPanel";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

const ContactDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  if (!id) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground">Contact not found</p>
        <Button onClick={() => navigate("/contacts")} className="mt-4">
          Back to Contacts
        </Button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="border-b p-4 flex items-center gap-4">
        <Button 
          variant="ghost" 
          size="sm"
          onClick={() => navigate("/contacts")}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Contacts
        </Button>
      </div>
      <div className="flex-1 overflow-hidden">
        <ContactDetailPanel contactId={id} showExpandButton={false} />
      </div>
    </div>
  );
};

export default ContactDetail;
