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
import { ArrowLeft, ArrowRight, Send, User, Search, MessageSquare, Mail } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
  const [channel, setChannel] = useState<"sms" | "email">("sms");
  const [campaignName, setCampaignName] = useState("");
  const [messageTemplate, setMessageTemplate] = useState("");
  const [subject, setSubject] = useState("");
  const [fromEmail, setFromEmail] = useState("");
  const [fromName, setFromName] = useState("");
  const [htmlTemplate, setHtmlTemplate] = useState("");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedContactIds, setSelectedContactIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [loadingContacts, setLoadingContacts] = useState(false);

  useEffect(() => {
    loadContacts();
  }, [channel]);

  const loadContacts = async () => {
    setLoadingContacts(true);
    try {
      let query = supabase
        .from("contacts")
        .select("id, full_name, phone_number, status, email")
        .order("full_name");

      // Filter based on channel
      if (channel === "sms") {
        query = query.not("phone_number", "is", null);
      } else {
        query = query.not("email", "is", null);
      }

      const { data, error } = await query;
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
    if (!campaignName || selectedContactIds.size === 0) {
      toast.error("Please fill in all required fields and select contacts");
      return;
    }

    if (channel === "sms" && !messageTemplate) {
      toast.error("Please enter a message template");
      return;
    }

    if (channel === "email" && (!subject || !htmlTemplate)) {
      toast.error("Please enter subject and email content");
      return;
    }

    setLoading(true);
    try {
      const { data: user } = await supabase.auth.getUser();
      
      const campaignData: any = {
        name: campaignName,
        channel,
        total_contacts: selectedContactIds.size,
        status: "draft",
        created_by: user.user?.id,
        audience_filter: { contact_ids: Array.from(selectedContactIds) }
      };

      if (channel === "sms") {
        campaignData.message_template = messageTemplate;
      } else {
        campaignData.subject = subject;
        campaignData.html_template = htmlTemplate;
        campaignData.plain_text_template = messageTemplate;
        campaignData.from_email = fromEmail;
        campaignData.from_name = fromName;
      }

      const { data, error } = await supabase
        .from("campaigns")
        .insert(campaignData)
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
            <p className="text-muted-foreground">Set up your marketing campaign</p>
          </div>
          <Button variant="ghost" onClick={() => navigate("/campaigns")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </div>

        {/* Channel Selection */}
        <Card>
          <CardHeader>
            <CardTitle>Select Channel</CardTitle>
            <CardDescription>Choose how you want to reach your audience</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={channel} onValueChange={(v) => {
              setChannel(v as "sms" | "email");
              setSelectedContactIds(new Set());
              loadContacts();
            }}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="sms" className="gap-2">
                  <MessageSquare className="h-4 w-4" />
                  SMS
                </TabsTrigger>
                <TabsTrigger value="email" className="gap-2">
                  <Mail className="h-4 w-4" />
                  Email
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </CardContent>
        </Card>

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
              <CardTitle>Compose {channel === "sms" ? "Message" : "Email"}</CardTitle>
              <CardDescription>
                {channel === "sms" ? "Write your SMS message template" : "Create your email campaign content"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {channel === "email" && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="subject">Subject Line *</Label>
                    <Input
                      id="subject"
                      placeholder="Your compelling subject line..."
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="fromName">From Name</Label>
                      <Input
                        id="fromName"
                        placeholder="Your Company"
                        value={fromName}
                        onChange={(e) => setFromName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="fromEmail">From Email</Label>
                      <Input
                        id="fromEmail"
                        type="email"
                        placeholder="noreply@yourdomain.com"
                        value={fromEmail}
                        onChange={(e) => setFromEmail(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="htmlTemplate">Email Content (HTML) *</Label>
                    <Textarea
                      id="htmlTemplate"
                      placeholder="<h1>Hello {FirstName}!</h1><p>Your email content...</p>"
                      value={htmlTemplate}
                      onChange={(e) => setHtmlTemplate(e.target.value)}
                      rows={10}
                    />
                    <p className="text-sm text-muted-foreground">
                      Use HTML for rich formatting. Available merge fields: {"{FirstName}"}
                    </p>
                  </div>
                </>
              )}

              <div className="space-y-2">
                <Label htmlFor="message">
                  {channel === "sms" ? "Message Template *" : "Plain Text Version"}
                </Label>
                <Textarea
                  id="message"
                  placeholder={channel === "sms" 
                    ? "Hi {FirstName}, check out our new product..."
                    : "Plain text version of your email..."}
                  value={messageTemplate}
                  onChange={(e) => setMessageTemplate(e.target.value)}
                  rows={6}
                  maxLength={channel === "sms" ? 160 : undefined}
                />
                {channel === "sms" && (
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Available merge fields: {"{FirstName}"}</span>
                    <span>{messageTemplate.length}/160 characters</span>
                  </div>
                )}
              </div>

              <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
                <h4 className="font-semibold mb-2 text-sm">Preview</h4>
                {channel === "email" && subject && (
                  <p className="text-sm font-semibold mb-2">Subject: {subject.replace("{FirstName}", "John")}</p>
                )}
                <div className="text-sm" dangerouslySetInnerHTML={{
                  __html: channel === "email" 
                    ? (htmlTemplate || "Your email content will appear here...").replace("{FirstName}", "John")
                    : (messageTemplate.replace("{FirstName}", "John") || "Your message will appear here...")
                }} />
              </div>

              <div className="flex justify-between gap-2">
                <Button variant="outline" onClick={() => setStep(1)}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
                <Button
                  onClick={() => setStep(3)}
                  disabled={channel === "sms" ? !messageTemplate : (!subject || !htmlTemplate)}
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
                  <h4 className="font-semibold mb-1">Channel</h4>
                  <p className="text-muted-foreground capitalize">{channel}</p>
                </div>

                <div>
                  <h4 className="font-semibold mb-1">Selected Contacts</h4>
                  <p className="text-muted-foreground">{selectedContactIds.size} contacts</p>
                </div>

                {channel === "email" && (
                  <>
                    <div>
                      <h4 className="font-semibold mb-1">Subject</h4>
                      <p className="text-muted-foreground">{subject}</p>
                    </div>
                    {fromName && (
                      <div>
                        <h4 className="font-semibold mb-1">From</h4>
                        <p className="text-muted-foreground">{fromName} {fromEmail && `<${fromEmail}>`}</p>
                      </div>
                    )}
                    <div>
                      <h4 className="font-semibold mb-1">Email Content</h4>
                      <div className="p-3 bg-muted rounded-lg max-h-40 overflow-y-auto">
                        <div className="text-sm" dangerouslySetInnerHTML={{ __html: htmlTemplate }} />
                      </div>
                    </div>
                  </>
                )}

                {channel === "sms" && (
                  <div>
                    <h4 className="font-semibold mb-1">Message Template</h4>
                    <p className="text-muted-foreground">{messageTemplate}</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-semibold mb-1">Total Contacts</h4>
                    <p className="text-muted-foreground">{selectedContactIds.size}</p>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-1">Estimated Cost</h4>
                    <p className="text-muted-foreground">
                      ${(selectedContactIds.size * (channel === "sms" ? 0.0079 : 0.001)).toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-warning/10 rounded-lg border border-warning/20">
                <h4 className="font-semibold mb-2 text-sm flex items-center gap-2">
                  <Send className="h-4 w-4" />
                  Ready to Launch
                </h4>
                <p className="text-sm text-muted-foreground">
                  Your campaign will be created as a draft. To actually send {channel === "sms" ? "messages" : "emails"}, you'll need to:
                </p>
                <ul className="text-sm text-muted-foreground list-disc list-inside mt-2 space-y-1">
                  {channel === "sms" ? (
                    <>
                      <li>Configure Twilio credentials in Settings</li>
                      <li>Set up Monday.com integration for contact data</li>
                    </>
                  ) : (
                    <>
                      <li>Configure AWS SES credentials in Settings</li>
                      <li>Verify your sender email domain in AWS SES</li>
                    </>
                  )}
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
