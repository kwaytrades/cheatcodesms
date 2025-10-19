import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft, ArrowRight, Send, User, Search } from "lucide-react";
import { toast } from "sonner";

interface Contact {
  id: string;
  full_name: string;
  phone_number: string | null;
  status: string | null;
  email: string | null;
}

const CampaignBuilder = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  
  // Campaign data
  const [campaignName, setCampaignName] = useState("");
  const [messageTemplate, setMessageTemplate] = useState("");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedContactIds, setSelectedContactIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [loadingContacts, setLoadingContacts] = useState(false);

  useEffect(() => {
    loadContacts();
  }, []);

  const loadContacts = async () => {
    setLoadingContacts(true);
    try {
      const { data, error } = await supabase
        .from("contacts")
        .select("id, full_name, phone_number, status, email")
        .not("phone_number", "is", null)
        .order("full_name");

      if (error) throw error;
      setContacts(data || []);
    } catch (error) {
      console.error("Error loading contacts:", error);
      toast.error("Failed to load contacts");
    } finally {
      setLoadingContacts(false);
    }
  };

  const filteredContacts = contacts.filter(contact =>
    contact.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    contact.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    contact.status?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleContact = (contactId: string) => {
    const newSelected = new Set(selectedContactIds);
    if (newSelected.has(contactId)) {
      newSelected.delete(contactId);
    } else {
      newSelected.add(contactId);
    }
    setSelectedContactIds(newSelected);
  };

  const toggleAllContacts = () => {
    if (selectedContactIds.size === filteredContacts.length) {
      setSelectedContactIds(new Set());
    } else {
      setSelectedContactIds(new Set(filteredContacts.map(c => c.id)));
    }
  };

  const handleCreateCampaign = async () => {
    if (!campaignName || !messageTemplate || selectedContactIds.size === 0) {
      toast.error("Please fill in all required fields and select contacts");
      return;
    }

    setLoading(true);
    try {
      const { data: user } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from("campaigns")
        .insert({
          name: campaignName,
          message_template: messageTemplate,
          total_contacts: selectedContactIds.size,
          status: "draft",
          created_by: user.user?.id,
          audience_filter: { contact_ids: Array.from(selectedContactIds) }
        })
        .select()
        .single();

      if (error) throw error;

      toast.success("Campaign created successfully!");
      navigate("/campaigns");
    } catch (error: any) {
      toast.error(error.message || "Failed to create campaign");
    } finally {
      setLoading(false);
    }
  };

  const progress = (step / 3) * 100;

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto space-y-6">{/* ... keep existing code */}
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Create Campaign</h1>
            <p className="text-muted-foreground">Set up your SMS marketing campaign</p>
          </div>
          <Button variant="ghost" onClick={() => navigate("/campaigns")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </div>

        {/* Progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className={step >= 1 ? "text-primary font-medium" : "text-muted-foreground"}>
              Campaign Details
            </span>
            <span className={step >= 2 ? "text-primary font-medium" : "text-muted-foreground"}>
              Message
            </span>
            <span className={step >= 3 ? "text-primary font-medium" : "text-muted-foreground"}>
              Review & Launch
            </span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Step 1: Select Contacts */}
        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle>Select Contacts</CardTitle>
              <CardDescription>Choose who will receive this campaign</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="campaign-name">Campaign Name *</Label>
                <Input
                  id="campaign-name"
                  placeholder="e.g., Fall Product Launch"
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Contacts ({selectedContactIds.size} selected)</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={toggleAllContacts}
                    disabled={loadingContacts}
                  >
                    {selectedContactIds.size === filteredContacts.length ? 'Deselect All' : 'Select All'}
                  </Button>
                </div>

                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search contacts..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>

                <Card className="border-border/50">
                  <ScrollArea className="h-[400px]">
                    {loadingContacts ? (
                      <div className="p-8 text-center text-muted-foreground">
                        Loading contacts...
                      </div>
                    ) : filteredContacts.length === 0 ? (
                      <div className="p-8 text-center">
                        <User className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
                        <p className="text-muted-foreground">
                          {contacts.length === 0
                            ? "No contacts found. Sync from Monday.com to get started."
                            : "No contacts match your search."}
                        </p>
                        {contacts.length === 0 && (
                          <Button
                            variant="outline"
                            className="mt-4"
                            onClick={() => navigate("/contacts")}
                          >
                            Go to Contacts
                          </Button>
                        )}
                      </div>
                    ) : (
                      <div className="divide-y divide-border/50">
                        {filteredContacts.map((contact) => (
                          <div
                            key={contact.id}
                            className="p-4 hover:bg-muted/50 transition-colors cursor-pointer"
                            onClick={() => toggleContact(contact.id)}
                          >
                            <div className="flex items-start gap-3">
                              <Checkbox
                                checked={selectedContactIds.has(contact.id)}
                                onCheckedChange={() => toggleContact(contact.id)}
                                onClick={(e) => e.stopPropagation()}
                              />
                              <div className="flex-1 min-w-0">
                                <p className="font-medium">{contact.full_name}</p>
                                <p className="text-sm text-muted-foreground">{contact.phone_number}</p>
                                {contact.status && (
                                  <span className="text-xs text-muted-foreground">{contact.status}</span>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </Card>
              </div>

              <div className="p-4 bg-muted/50 rounded-lg">
                <div className="flex justify-between text-sm">
                  <span>Selected contacts</span>
                  <span className="font-semibold">{selectedContactIds.size}</span>
                </div>
                <div className="flex justify-between text-sm mt-1">
                  <span>Estimated cost</span>
                  <span className="font-semibold text-primary">
                    ${(selectedContactIds.size * 0.0079).toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  onClick={() => setStep(2)}
                  disabled={!campaignName || selectedContactIds.size === 0}
                >
                  Next: Compose Message
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Message Template */}
        {step === 2 && (
          <Card>
            <CardHeader>
              <CardTitle>Compose Message</CardTitle>
              <CardDescription>Write your SMS message template</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="message">Message Template *</Label>
                <Textarea
                  id="message"
                  placeholder="Hi {FirstName}, check out our new product..."
                  value={messageTemplate}
                  onChange={(e) => setMessageTemplate(e.target.value)}
                  rows={6}
                  maxLength={160}
                />
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Available merge fields: {"{FirstName}"}, {"{Product}"}, {"{LeadScore}"}</span>
                  <span>{messageTemplate.length}/160 characters</span>
                </div>
              </div>

              <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
                <h4 className="font-semibold mb-2 text-sm">Preview</h4>
                <p className="text-sm">
                  {messageTemplate.replace("{FirstName}", "John") || "Your message will appear here..."}
                </p>
              </div>

              <div className="flex justify-between gap-2">
                <Button variant="outline" onClick={() => setStep(1)}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
                <Button
                  onClick={() => setStep(3)}
                  disabled={!messageTemplate}
                >
                  Next: Review
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Review & Launch */}
        {step === 3 && (
          <Card>
            <CardHeader>
              <CardTitle>Review & Launch</CardTitle>
              <CardDescription>Review your campaign before sending</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-1">Campaign Name</h4>
                  <p className="text-muted-foreground">{campaignName}</p>
                </div>

                <div>
                  <h4 className="font-semibold mb-1">Selected Contacts</h4>
                  <p className="text-muted-foreground">{selectedContactIds.size} contacts</p>
                </div>

                <div>
                  <h4 className="font-semibold mb-1">Message Template</h4>
                  <p className="text-muted-foreground">{messageTemplate}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-semibold mb-1">Total Contacts</h4>
                    <p className="text-muted-foreground">{selectedContactIds.size}</p>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-1">Estimated Cost</h4>
                    <p className="text-muted-foreground">${(selectedContactIds.size * 0.0079).toFixed(2)}</p>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-warning/10 rounded-lg border border-warning/20">
                <h4 className="font-semibold mb-2 text-sm flex items-center gap-2">
                  <Send className="h-4 w-4" />
                  Ready to Launch
                </h4>
                <p className="text-sm text-muted-foreground">
                  Your campaign will be created as a draft. To actually send messages, you'll need to:
                </p>
                <ul className="text-sm text-muted-foreground list-disc list-inside mt-2 space-y-1">
                  <li>Configure Twilio credentials in backend settings</li>
                  <li>Set up Monday.com integration for contact data</li>
                  <li>Activate the campaign from the campaigns list</li>
                </ul>
              </div>

              <div className="flex justify-between gap-2">
                <Button variant="outline" onClick={() => setStep(2)}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
                <Button
                  onClick={handleCreateCampaign}
                  disabled={loading}
                  className="gap-2"
                >
                  <Send className="h-4 w-4" />
                  {loading ? "Creating..." : "Create Campaign"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default CampaignBuilder;
