import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Search, RefreshCw, Plus, Trash2, Settings2, Mail, Phone, Download, Upload } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { MondayBoardSettings } from "@/components/MondayBoardSettings";
import { ImportContactsDialog } from "@/components/ImportContactsDialog";

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

type ColumnKey = 'full_name' | 'email' | 'phone_number' | 'status' | 'lead_score' | 'products_interested' | 'tags' | 'last_contact_date' | 'engagement_score' | 'created_at';

interface ColumnConfig {
  key: ColumnKey;
  label: string;
  visible: boolean;
}

const DEFAULT_COLUMNS: ColumnConfig[] = [
  { key: 'full_name', label: 'Name', visible: true },
  { key: 'email', label: 'Email', visible: true },
  { key: 'phone_number', label: 'Phone', visible: true },
  { key: 'status', label: 'Status', visible: true },
  { key: 'lead_score', label: 'Lead Score', visible: false },
  { key: 'products_interested', label: 'Products Interested', visible: true },
  { key: 'tags', label: 'Tags', visible: false },
  { key: 'last_contact_date', label: 'Last Contact', visible: true },
  { key: 'engagement_score', label: 'Engagement', visible: false },
  { key: 'created_at', label: 'Created', visible: false },
];

const Contacts = () => {
  const navigate = useNavigate();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncingToMonday, setSyncingToMonday] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [mondayBoardIds, setMondayBoardIds] = useState<string[]>([]);
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());
  const [columns, setColumns] = useState<ColumnConfig[]>(DEFAULT_COLUMNS);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newContact, setNewContact] = useState({
    full_name: '',
    email: '',
    phone_number: '',
    status: 'Lead'
  });

  useEffect(() => {
    loadContacts();
    const stored = localStorage.getItem("monday_board_ids");
    if (stored) {
      setMondayBoardIds(stored.split(",").map(id => id.trim()).filter(id => id.length > 0));
    }
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
    if (mondayBoardIds.length === 0) {
      toast.error("Please configure Monday board IDs first");
      return;
    }

    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-contacts', {
        body: { boardIds: mondayBoardIds }
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

  const handleSyncToMonday = async () => {
    if (selectedContacts.size === 0) {
      toast.error("Please select contacts to sync");
      return;
    }

    setSyncingToMonday(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-to-monday', {
        body: { contactIds: Array.from(selectedContacts) }
      });

      if (error) throw error;

      toast.success(`Synced ${data.successCount} of ${data.total} contacts to Monday.com`);
      if (data.failCount > 0) {
        toast.error(`${data.failCount} contacts failed to sync`);
      }
      setSelectedContacts(new Set());
    } catch (error: any) {
      if (error.message?.includes('MONDAY_API_KEY')) {
        toast.error("Monday.com API key not configured");
      } else {
        toast.error("Failed to sync to Monday.com");
      }
    } finally {
      setSyncingToMonday(false);
    }
  };

  const handleExportCSV = async () => {
    setExporting(true);
    try {
      // Fetch all contacts with complete data
      const { data: allContacts, error } = await supabase
        .from("contacts")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Prepare CSV headers
      const headers = [
        'Full Name', 'First Name', 'Last Name', 'Email', 'Phone Number',
        'Status', 'Lead Score', 'Engagement Score',
        'Products Interested', 'Products Owned', 'Tags',
        'AI Interests', 'AI Complaints', 'AI Preferences', 'AI Important Notes',
        'Customer Income Level', 'Customer Interest Level',
        'Last Contact Date', 'Created At', 'Synced At',
        'Monday Item ID', 'Monday Board ID', 'Monday Board Name',
        'Notes'
      ];

      // Convert contacts to CSV rows
      const rows = allContacts?.map((contact: any) => {
        const aiProfile = contact.ai_profile || {};
        const customerProfile = contact.customer_profile || {};

        return [
          contact.full_name || '',
          contact.first_name || '',
          contact.last_name || '',
          contact.email || '',
          contact.phone_number || '',
          contact.status || '',
          contact.lead_score ?? '',
          contact.engagement_score ?? '',
          Array.isArray(contact.products_interested) ? contact.products_interested.join(', ') : '',
          Array.isArray(contact.products_owned) ? contact.products_owned.join(', ') : '',
          Array.isArray(contact.tags) ? contact.tags.join(', ') : '',
          Array.isArray(aiProfile.interests) ? aiProfile.interests.join(', ') : '',
          Array.isArray(aiProfile.complaints) ? aiProfile.complaints.join(' | ') : '',
          aiProfile.preferences ? JSON.stringify(aiProfile.preferences) : '',
          Array.isArray(aiProfile.important_notes) ? aiProfile.important_notes.join(' | ') : '',
          customerProfile.income_level || '',
          customerProfile.interest_level || '',
          contact.last_contact_date || '',
          contact.created_at || '',
          contact.synced_at || '',
          contact.monday_item_id || '',
          contact.monday_board_id || '',
          contact.monday_board_name || '',
          contact.notes || ''
        ].map(value => `"${String(value).replace(/"/g, '""')}"`); // Escape quotes
      }) || [];

      // Combine headers and rows
      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.join(','))
      ].join('\n');

      // Create blob and download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `contacts_export_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success(`Exported ${allContacts?.length || 0} contacts to CSV`);
    } catch (error) {
      console.error("Error exporting CSV:", error);
      toast.error("Failed to export contacts");
    } finally {
      setExporting(false);
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

  const handleSelectAll = () => {
    if (selectedContacts.size === filteredContacts.length) {
      setSelectedContacts(new Set());
    } else {
      setSelectedContacts(new Set(filteredContacts.map(c => c.id)));
    }
  };

  const handleSelectContact = (id: string) => {
    const newSelected = new Set(selectedContacts);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedContacts(newSelected);
  };

  const handleDeleteSelected = async () => {
    if (selectedContacts.size === 0) return;
    
    try {
      const { error } = await supabase
        .from('contacts')
        .delete()
        .in('id', Array.from(selectedContacts));

      if (error) throw error;
      
      toast.success(`Deleted ${selectedContacts.size} contact(s)`);
      setSelectedContacts(new Set());
      await loadContacts();
    } catch (error) {
      console.error("Error deleting contacts:", error);
      toast.error("Failed to delete contacts");
    }
  };

  const handleAddContact = async () => {
    if (!newContact.full_name.trim()) {
      toast.error("Name is required");
      return;
    }

    try {
      const { error } = await supabase
        .from('contacts')
        .insert([newContact]);

      if (error) throw error;

      toast.success("Contact added successfully");
      setIsAddDialogOpen(false);
      setNewContact({ full_name: '', email: '', phone_number: '', status: 'Lead' });
      await loadContacts();
    } catch (error) {
      console.error("Error adding contact:", error);
      toast.error("Failed to add contact");
    }
  };

  const toggleColumn = (key: ColumnKey) => {
    setColumns(columns.map(col => 
      col.key === key ? { ...col, visible: !col.visible } : col
    ));
  };

  const renderCellContent = (contact: Contact, columnKey: ColumnKey) => {
    switch (columnKey) {
      case 'full_name':
        return <span className="font-medium">{contact.full_name}</span>;
      case 'email':
        return contact.email ? (
          <div className="flex items-center gap-2">
            <Mail className="h-3 w-3 text-muted-foreground" />
            <span className="truncate">{contact.email}</span>
          </div>
        ) : '-';
      case 'phone_number':
        return contact.phone_number ? (
          <div className="flex items-center gap-2">
            <Phone className="h-3 w-3 text-muted-foreground" />
            <span>{contact.phone_number}</span>
          </div>
        ) : '-';
      case 'status':
        return contact.status ? <Badge variant="outline">{contact.status}</Badge> : '-';
      case 'lead_score':
        return contact.lead_score ?? '-';
      case 'products_interested':
        return contact.products_interested && contact.products_interested.length > 0 ? (
          <div className="flex gap-1 flex-wrap">
            {contact.products_interested.slice(0, 2).map((product, idx) => (
              <Badge key={idx} variant="secondary" className="text-xs">{product}</Badge>
            ))}
            {contact.products_interested.length > 2 && (
              <Badge variant="secondary" className="text-xs">+{contact.products_interested.length - 2}</Badge>
            )}
          </div>
        ) : '-';
      case 'tags':
        return contact.tags && contact.tags.length > 0 ? (
          <div className="flex gap-1 flex-wrap">
            {contact.tags.map((tag, idx) => (
              <Badge key={idx} variant="outline" className="text-xs">{tag}</Badge>
            ))}
          </div>
        ) : '-';
      case 'last_contact_date':
        return contact.last_contact_date ? format(new Date(contact.last_contact_date), 'MMM d, yyyy') : '-';
      case 'engagement_score':
        return contact.engagement_score;
      case 'created_at':
        return format(new Date(contact.created_at), 'MMM d, yyyy');
      default:
        return '-';
    }
  };

  const visibleColumns = columns.filter(col => col.visible);

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse">Loading contacts...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b bg-background p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Contacts</h1>
            <p className="text-sm text-muted-foreground">Manage your customer relationships</p>
          </div>
          <div className="flex gap-2">
            <ImportContactsDialog onImportComplete={loadContacts} />
            <MondayBoardSettings onBoardsChanged={setMondayBoardIds} />
            <Button onClick={handleSync} disabled={syncing} variant="outline" size="sm">
              <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 flex-1">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search contacts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
            
            {selectedContacts.size > 0 && (
              <>
                <span className="text-sm text-muted-foreground">
                  {selectedContacts.size} selected
                </span>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleSyncToMonday}
                  disabled={syncingToMonday}
                  className="gap-2"
                >
                  <Upload className={`h-4 w-4 ${syncingToMonday ? 'animate-pulse' : ''}`} />
                  Sync to Monday
                </Button>
                <Button 
                  variant="destructive" 
                  size="sm" 
                  onClick={handleDeleteSelected}
                  className="gap-2"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </Button>
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleExportCSV}
              disabled={exporting}
              className="gap-2"
            >
              <Download className={`h-4 w-4 ${exporting ? 'animate-pulse' : ''}`} />
              Export CSV
            </Button>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Settings2 className="h-4 w-4" />
                  Columns
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56" align="end">
                <div className="space-y-2">
                  <h4 className="font-medium text-sm">Toggle columns</h4>
                  {columns.map((column) => (
                    <div key={column.key} className="flex items-center gap-2">
                      <Checkbox
                        id={column.key}
                        checked={column.visible}
                        onCheckedChange={() => toggleColumn(column.key)}
                      />
                      <label
                        htmlFor={column.key}
                        className="text-sm cursor-pointer flex-1"
                      >
                        {column.label}
                      </label>
                    </div>
                  ))}
                </div>
              </PopoverContent>
            </Popover>

            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-2">
                  <Plus className="h-4 w-4" />
                  Add Contact
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Contact</DialogTitle>
                  <DialogDescription>
                    Create a new contact manually
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name *</Label>
                    <Input
                      id="name"
                      value={newContact.full_name}
                      onChange={(e) => setNewContact({ ...newContact, full_name: e.target.value })}
                      placeholder="John Doe"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={newContact.email}
                      onChange={(e) => setNewContact({ ...newContact, email: e.target.value })}
                      placeholder="john@example.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      value={newContact.phone_number}
                      onChange={(e) => setNewContact({ ...newContact, phone_number: e.target.value })}
                      placeholder="+1234567890"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="status">Status</Label>
                    <Input
                      id="status"
                      value={newContact.status}
                      onChange={(e) => setNewContact({ ...newContact, status: e.target.value })}
                      placeholder="Lead"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleAddContact}>Add Contact</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="p-8 text-center text-muted-foreground">
            Loading contacts...
          </div>
        ) : filteredContacts.length === 0 ? (
          <div className="p-8 text-center">
            <div className="text-muted-foreground mb-2">No contacts found</div>
            <p className="text-sm text-muted-foreground">
              {searchQuery ? 'Try adjusting your search' : 'Click "Sync from Monday" or "Add Contact" to get started'}
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={selectedContacts.size === filteredContacts.length}
                    onCheckedChange={handleSelectAll}
                  />
                </TableHead>
                {visibleColumns.map((column) => (
                  <TableHead key={column.key}>{column.label}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredContacts.map((contact) => (
                <TableRow
                  key={contact.id}
                  className="cursor-pointer"
                  onClick={() => navigate(`/contacts/${contact.id}`)}
                >
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selectedContacts.has(contact.id)}
                      onCheckedChange={() => handleSelectContact(contact.id)}
                    />
                  </TableCell>
                  {visibleColumns.map((column) => (
                    <TableCell key={column.key}>
                      {renderCellContent(contact, column.key)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
};

export default Contacts;
