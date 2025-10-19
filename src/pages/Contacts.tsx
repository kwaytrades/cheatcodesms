import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Search, RefreshCw, User, Mail, Phone, Tag } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface Contact {
  id: string;
  full_name: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone_number: string | null;
  status: string | null;
  lead_score: number | null;
  products_interested: string[] | null;
  tags: string[] | null;
  last_contact_date: string | null;
  engagement_score: number;
  created_at: string;
}

const Contacts = () => {
  const navigate = useNavigate();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    loadContacts();
  }, []);

  useEffect(() => {
    if (searchQuery) {
      const filtered = contacts.filter(contact =>
        contact.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        contact.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        contact.phone_number?.includes(searchQuery)
      );
      setFilteredContacts(filtered);
    } else {
      setFilteredContacts(contacts);
    }
  }, [searchQuery, contacts]);

  const loadContacts = async () => {
    try {
      const { data, error } = await supabase
        .from("contacts")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setContacts(data || []);
      setFilteredContacts(data || []);
    } catch (error) {
      console.error("Error loading contacts:", error);
      toast.error("Failed to load contacts");
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-contacts', {
        body: { boardIds: [] } // Empty array syncs all accessible boards
      });

      if (error) throw error;

      toast.success(`Synced ${data.total} contacts from Monday.com`);
      await loadContacts();
    } catch (error: any) {
      if (error.message?.includes('MONDAY_API_KEY')) {
        toast.error("Monday.com API key not configured. Please add it in backend settings.");
      } else {
        toast.error("Failed to sync contacts");
      }
    } finally {
      setSyncing(false);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map(n => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getStatusColor = (status: string | null) => {
    if (!status) return "outline";
    const s = status.toLowerCase();
    if (s.includes("lead") || s.includes("prospect")) return "default";
    if (s.includes("customer") || s.includes("active")) return "default";
    if (s.includes("closed") || s.includes("won")) return "default";
    return "secondary";
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse">Loading contacts...</div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Contacts</h1>
          <p className="text-muted-foreground">Manage your customer relationships</p>
        </div>
        <Button onClick={handleSync} disabled={syncing} className="gap-2">
          <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Syncing...' : 'Sync from Monday'}
        </Button>
      </div>

      {/* Search */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search contacts by name, email, or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Total Contacts</CardDescription>
            <CardTitle className="text-3xl">{contacts.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Leads</CardDescription>
            <CardTitle className="text-3xl">
              {contacts.filter(c => c.status?.toLowerCase().includes('lead')).length}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Customers</CardDescription>
            <CardTitle className="text-3xl">
              {contacts.filter(c => c.status?.toLowerCase().includes('customer')).length}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>With Phone</CardDescription>
            <CardTitle className="text-3xl">
              {contacts.filter(c => c.phone_number).length}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Contacts List */}
      {filteredContacts.length === 0 ? (
        <Card className="border-dashed">
          <CardHeader className="text-center">
            <User className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <CardTitle>No contacts yet</CardTitle>
            <CardDescription>
              Click "Sync from Monday" to import your contacts from Monday.com
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredContacts.map((contact) => (
            <Card
              key={contact.id}
              className="border-border/50 hover:border-primary/50 transition-colors cursor-pointer"
              onClick={() => navigate(`/contacts/${contact.id}`)}
            >
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <Avatar className="h-12 w-12">
                    <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                      {getInitials(contact.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="font-semibold text-lg truncate">{contact.full_name}</h3>
                      {contact.status && (
                        <Badge variant={getStatusColor(contact.status)} className="shrink-0">
                          {contact.status}
                        </Badge>
                      )}
                    </div>

                    <div className="space-y-1 text-sm text-muted-foreground">
                      {contact.email && (
                        <div className="flex items-center gap-2">
                          <Mail className="h-3 w-3" />
                          <span className="truncate">{contact.email}</span>
                        </div>
                      )}
                      {contact.phone_number && (
                        <div className="flex items-center gap-2">
                          <Phone className="h-3 w-3" />
                          <span>{contact.phone_number}</span>
                        </div>
                      )}
                    </div>

                    {contact.products_interested && contact.products_interested.length > 0 && (
                      <div className="flex items-center gap-2 mt-3">
                        <Tag className="h-3 w-3 text-muted-foreground" />
                        <div className="flex gap-1 flex-wrap">
                          {contact.products_interested.slice(0, 3).map((product, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs">
                              {product}
                            </Badge>
                          ))}
                          {contact.products_interested.length > 3 && (
                            <Badge variant="outline" className="text-xs">
                              +{contact.products_interested.length - 3}
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}

                    {contact.last_contact_date && (
                      <div className="text-xs text-muted-foreground mt-2">
                        Last contact: {format(new Date(contact.last_contact_date), 'MMM d, yyyy')}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default Contacts;
