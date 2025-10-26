import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Search, Plus, Settings2, Mail, Phone, Filter, TrendingUp, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { FilterBuilder, FilterCondition } from "@/components/FilterBuilder";
import { SegmentsSidebar } from "@/components/SegmentsSidebar";
import { BulkActionsToolbar } from "@/components/BulkActionsToolbar";
import { ImportContactsDialog } from "@/components/ImportContactsDialog";
import { AddContactDialog } from "@/components/AddContactDialog";
import { CSVImportDialog } from "@/components/CSVImportDialog";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { RecalculateScoresButton } from "@/components/RecalculateScoresButton";
import { GlobalScoreRefreshButton } from "@/components/GlobalScoreRefreshButton";
import { LeadStatusBadge } from "@/components/ui/lead-status-badge";
import { TierBadge } from "@/components/ui/tier-badge";

interface Contact {
  id: string;
  full_name: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone_number: string | null;
  customer_tier: string | null;
  lead_status: string | null;
  lead_score: number | null;
  likelihood_to_buy_score: number | null;
  likelihood_category: string | null;
  products_owned: string[] | null;
  tags: string[] | null;
  last_contact_date: string | null;
  engagement_score: number;
  total_spent: number | null;
  trading_experience: string | null;
  trading_style: string | null;
  account_size: string | null;
  created_at: string;
  has_disputed: boolean | null;
  disputed_amount: number | null;
}

type ColumnKey = 'full_name' | 'email' | 'phone_number' | 'customer_tier' | 'likelihood_to_buy_score' | 'lead_status' | 'lead_score' | 'products_owned' | 'tags' | 'last_contact_date' | 'total_spent' | 'trading_experience' | 'created_at';

interface ColumnConfig {
  key: ColumnKey;
  label: string;
  visible: boolean;
}

const DEFAULT_COLUMNS: ColumnConfig[] = [
  { key: 'full_name', label: 'Name', visible: true },
  { key: 'email', label: 'Email', visible: true },
  { key: 'phone_number', label: 'Phone', visible: true },
  { key: 'customer_tier', label: 'Tier', visible: true },
  { key: 'lead_status', label: 'Status', visible: true },
  { key: 'lead_score', label: 'Score', visible: true },
  { key: 'likelihood_to_buy_score', label: 'Likelihood', visible: false },
  { key: 'products_owned', label: 'Products', visible: true },
  { key: 'tags', label: 'Tags', visible: false },
  { key: 'last_contact_date', label: 'Last Activity', visible: true },
  { key: 'total_spent', label: 'Lifetime Value', visible: false },
  { key: 'trading_experience', label: 'Experience', visible: false },
  { key: 'created_at', label: 'Customer Since', visible: false },
];

const STATUS_COLORS: Record<string, string> = {
  'cold': 'bg-info/20 text-info border-info/30',
  'warm': 'bg-warning/20 text-warning border-warning/30',
  'hot': 'bg-destructive/20 text-destructive border-destructive/30',
  'customer': 'bg-status-customer/10 text-status-customer border-status-customer/20',
};

const Contacts = () => {
  const navigate = useNavigate();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());
  const [columns, setColumns] = useState<ColumnConfig[]>(DEFAULT_COLUMNS);
  const [filters, setFilters] = useState<FilterCondition[]>([]);
  const [selectedSegment, setSelectedSegment] = useState<any>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [showSegments, setShowSegments] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(1000);
  const [totalCount, setTotalCount] = useState(0);
  const [sortColumn, setSortColumn] = useState<ColumnKey | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [contactsWithoutScores, setContactsWithoutScores] = useState(0);

  useEffect(() => {
    loadContacts();
  }, [currentPage, pageSize, sortColumn, sortDirection]);

  useEffect(() => {
    loadContacts();
  }, [currentPage, sortColumn, sortDirection, filters]);
  
  useEffect(() => {
    applyFiltersAndSearch();
  }, [searchQuery, contacts, selectedSegment]);

  // Real-time subscription for contact updates
  useEffect(() => {
    let reconnectAttempts = 0;
    const maxReconnects = 5;

    const setupChannel = () => {
      const channel = supabase
        .channel('contacts-changes')
        .on('postgres_changes', 
          { event: 'UPDATE', schema: 'public', table: 'contacts' },
          (payload) => {
            console.log('📡 Realtime contact update:', payload.new.id);
            
            // Update local state with new contact data
            setContacts(prev => prev.map(c => 
              c.id === payload.new.id ? { ...c, ...payload.new as Contact } : c
            ));
            setFilteredContacts(prev => prev.map(c => 
              c.id === payload.new.id ? { ...c, ...payload.new as Contact } : c
            ));
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log('✅ Realtime subscription active');
            reconnectAttempts = 0;
          } else if (status === 'CLOSED' && reconnectAttempts < maxReconnects) {
            reconnectAttempts++;
            console.log(`🔄 Reconnecting... (${reconnectAttempts}/${maxReconnects})`);
            setTimeout(() => setupChannel(), 2000 * reconnectAttempts);
          }
        });

      return channel;
    };

    const channel = setupChannel();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadContacts = async () => {
    try {
      setLoading(true);
      
      // Helper function to apply a single filter to a query
      const applyFilter = (query: any, filter: FilterCondition) => {
        const { field, operator, value } = filter;
        
        switch (operator) {
          case 'equals':
            return query.eq(field, value);
          case 'contains':
            return query.ilike(field, `%${value}%`);
          case 'greater':
          case 'greater_than':
            return query.gt(field, value);
          case 'less':
          case 'less_than':
            return query.lt(field, value);
          case 'in':
            const values = typeof value === 'string' ? value.split(',').map((v: string) => v.trim()) : value;
            return query.in(field, values);
          default:
            return query;
        }
      };
      
      // Build count query with filters
      let countQuery: any = supabase.from("contacts").select("*", { count: 'exact', head: true });
      for (const filter of filters) {
        countQuery = applyFilter(countQuery, filter);
      }
      
      // Get total count
      const { count } = await countQuery;
      setTotalCount(count || 0);
      
      // Build data query with filters
      let dataQuery: any = supabase.from("contacts").select("*");
      for (const filter of filters) {
        dataQuery = applyFilter(dataQuery, filter);
      }
      
      // Apply pagination
      const from = (currentPage - 1) * pageSize;
      const to = from + pageSize - 1;
      dataQuery = dataQuery.range(from, to);
      
      // Apply sorting
      const orderColumn = sortColumn || 'likelihood_to_buy_score';
      const orderDirection = sortColumn ? sortDirection === 'asc' : false;
      dataQuery = dataQuery.order(orderColumn, { ascending: orderDirection, nullsFirst: false });
      
      // Execute query
      const { data, error } = await dataQuery;
      
      if (error) throw error;
      setContacts(data || []);
      setFilteredContacts(data || []);
    } catch (error: any) {
      toast.error(error.message || "Failed to load contacts");
    } finally {
      setLoading(false);
    }
  };

  const applyFiltersAndSearch = () => {
    let filtered = [...contacts];

    // Apply search
    if (searchQuery) {
      filtered = filtered.filter(contact =>
        contact.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        contact.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        contact.phone_number?.includes(searchQuery)
      );
    }

    // Apply filters from FilterBuilder
    if (filters.length > 0) {
      filtered = filtered.filter(contact => {
        return filters.every(filter => {
          const value = contact[filter.field as keyof Contact];
          
          switch (filter.operator) {
            case 'contains':
              return String(value || '').toLowerCase().includes(String(filter.value).toLowerCase());
            case 'equals':
              return value === filter.value;
            case 'greater':
              return Number(value) > Number(filter.value);
            case 'less':
              return Number(value) < Number(filter.value);
            case 'includes':
              return Array.isArray(value) && value.some(v => String(v).toLowerCase().includes(String(filter.value).toLowerCase()));
            default:
              return true;
          }
        });
      });
    }

    // Apply segment filters
    if (selectedSegment?.filter_config?.filters) {
      const segmentFilters = selectedSegment.filter_config.filters;
      filtered = filtered.filter(contact => {
        return segmentFilters.every((filter: any) => {
          const value = contact[filter.field as keyof Contact];
          
          switch (filter.operator) {
            case 'equals':
              return value === filter.value;
            case 'greater':
              return Number(value) > Number(filter.value);
            case 'within_days':
              if (!contact.created_at && !contact.last_contact_date) return false;
              const date = new Date(contact.last_contact_date || contact.created_at);
              const now = new Date();
              const daysDiff = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
              return daysDiff <= Number(filter.value);
            default:
              return true;
          }
        });
      });
    }

    setFilteredContacts(filtered);
  };

  const handleColumnSort = (columnKey: ColumnKey) => {
    if (sortColumn === columnKey) {
      // Toggle direction
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // New column - default to desc for scores, asc for text
      setSortColumn(columnKey);
      const numericColumns = ['lead_score', 'likelihood_to_buy_score', 'engagement_score', 'total_spent'];
      setSortDirection(numericColumns.includes(columnKey) ? 'desc' : 'asc');
    }
    setCurrentPage(1); // Reset to first page when sorting
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
    
    if (!confirm(`Are you sure you want to delete ${selectedContacts.size} contact(s)? This action cannot be undone.`)) {
      return;
    }
    
    try {
      const contactIds = Array.from(selectedContacts);
      const BATCH_SIZE = 50;
      
      for (let i = 0; i < contactIds.length; i += BATCH_SIZE) {
        const batch = contactIds.slice(i, i + BATCH_SIZE);
        
        await Promise.all([
          supabase.from('contact_activities').delete().in('contact_id', batch),
          supabase.from('contact_assignments').delete().in('contact_id', batch),
          supabase.from('ai_messages').delete().in('contact_id', batch),
          supabase.from('purchases').delete().in('contact_id', batch),
          supabase.from('notifications').delete().in('contact_id', batch),
        ]);
        
        const { error } = await supabase
          .from('contacts')
          .delete()
          .in('id', batch);

        if (error) throw error;
      }
      
      toast.success(`Deleted ${selectedContacts.size} contact(s)`);
      setSelectedContacts(new Set());
      await loadContacts();
    } catch (error) {
      console.error("Error deleting contacts:", error);
      toast.error("Failed to delete contacts. Please try again.");
    }
  };

  const handleDeleteAll = async () => {
    const confirmed = confirm(
      `⚠️ WARNING: This will permanently delete ALL ${totalCount.toLocaleString()} contacts and their related data from your database. This action cannot be undone. Type "DELETE ALL" to confirm.`
    );
    
    if (!confirmed) return;
    
    const doubleConfirm = prompt('Type "DELETE ALL" to confirm:');
    if (doubleConfirm !== "DELETE ALL") {
      toast.info("Deletion cancelled");
      return;
    }
    
    try {
      toast.info("Deleting all contacts... This may take a moment.");
      
      // Delete all related records first
      await Promise.all([
        supabase.from('contact_activities').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
        supabase.from('contact_assignments').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
        supabase.from('ai_messages').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
        supabase.from('purchases').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
        supabase.from('notifications').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
      ]);
      
      // Now delete all contacts
      const { error } = await supabase
        .from('contacts')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');

      if (error) throw error;
      
      toast.success("All contacts deleted successfully");
      setSelectedContacts(new Set());
      setCurrentPage(1);
      await loadContacts();
    } catch (error) {
      console.error("Error deleting all contacts:", error);
      toast.error("Failed to delete all contacts. Please try again.");
    }
  };

  const handleExportCSV = async () => {
    try {
      const contactsToExport = selectedContacts.size > 0 
        ? filteredContacts.filter(c => selectedContacts.has(c.id))
        : filteredContacts;

      const headers = ['Name', 'Email', 'Phone', 'Status', 'Lead Score', 'Total Spent', 'Created'];
      const rows = contactsToExport.map(contact => [
        contact.full_name || '',
        contact.email || '',
        contact.phone_number || '',
        contact.lead_status || '',
        contact.lead_score ?? '',
        contact.total_spent ?? '',
        contact.created_at ? format(new Date(contact.created_at), 'yyyy-MM-dd') : ''
      ].map(value => `"${String(value).replace(/"/g, '""')}"`));

      const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `contacts_export_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success(`Exported ${contactsToExport.length} contacts`);
    } catch (error) {
      console.error("Error exporting:", error);
      toast.error("Failed to export contacts");
    }
  };

  const handleSaveSegment = async (name: string, description: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('segments')
        .insert([{
          name,
          description,
          filter_config: { filters } as any,
          created_by: user.id,
          customer_count: filteredContacts.length
        }]);

      if (error) throw error;
      toast.success('Segment saved successfully');
    } catch (error) {
      console.error('Error saving segment:', error);
      toast.error('Failed to save segment');
    }
  };

  const toggleColumn = (key: ColumnKey) => {
    setColumns(columns.map(col => 
      col.key === key ? { ...col, visible: !col.visible } : col
    ));
  };

  const getScoreColor = (score: number | null) => {
    if (!score) return 'bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-500/30 glow-blue';
    if (score >= 80) return 'bg-green-500/20 text-green-700 dark:text-green-300 border-green-500/30 glow-green';
    if (score >= 70) return 'bg-red-500/20 text-red-700 dark:text-red-300 border-red-500/30 glow-red';
    if (score >= 50) return 'bg-orange-500/20 text-orange-700 dark:text-orange-300 border-orange-500/30 glow-orange';
    if (score >= 30) return 'bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 border-cyan-500/30 glow-cyan';
    return 'bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-500/30 glow-blue';
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
      case 'customer_tier':
        return contact.customer_tier ? (
          <TierBadge 
            tier={contact.customer_tier}
            disputedAmount={contact.disputed_amount || 0}
            hasDisputed={contact.has_disputed || false}
            showIcon={true}
          />
        ) : '-';
      case 'likelihood_to_buy_score':
        return contact.likelihood_to_buy_score !== null ? (
          <div className="flex items-center gap-2">
            <Badge className={getScoreColor(contact.likelihood_to_buy_score)}>
              {contact.likelihood_to_buy_score}
            </Badge>
            {contact.likelihood_category && (
              <span className="text-xs text-muted-foreground capitalize">
                {contact.likelihood_category}
              </span>
            )}
          </div>
        ) : '-';
      case 'lead_status':
        return contact.lead_status && contact.lead_score !== null ? (
          <LeadStatusBadge score={contact.lead_score} status={contact.lead_status} />
        ) : '-';
      case 'lead_score':
        return contact.lead_score !== null ? (
          <div className="flex items-center gap-2">
            <Badge className={getScoreColor(contact.lead_score)}>
              {contact.lead_score}
            </Badge>
            <TrendingUp className="h-3 w-3 text-muted-foreground" />
          </div>
        ) : '-';
      case 'products_owned':
        return contact.products_owned && contact.products_owned.length > 0 ? (
          <div className="flex gap-1 flex-wrap">
            {contact.products_owned.slice(0, 2).map((product, idx) => (
              <Badge key={idx} variant="secondary" className="text-xs">{product}</Badge>
            ))}
            {contact.products_owned.length > 2 && (
              <Badge variant="secondary" className="text-xs">+{contact.products_owned.length - 2}</Badge>
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
      case 'total_spent':
        return contact.total_spent ? `$${contact.total_spent.toFixed(2)}` : '-';
      case 'trading_experience':
        return contact.trading_experience ? (
          <Badge variant="outline" className="text-xs capitalize">{contact.trading_experience}</Badge>
        ) : '-';
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
    <ResizablePanelGroup direction="horizontal" className="h-full">
      {showSegments && (
        <>
          <ResizablePanel defaultSize={15} minSize={12} maxSize={20} className="hidden md:block">
            <SegmentsSidebar 
              onSegmentSelect={(segment) => {
                setSelectedSegment(segment);
                if (segment) setFilters([]);
              }}
              selectedSegmentId={selectedSegment?.id || null}
              onToggle={() => setShowSegments(false)}
            />
          </ResizablePanel>
          <ResizableHandle className="hidden md:flex" />
        </>
      )}
      
      <ResizablePanel defaultSize={85}>
        <div className="flex flex-col h-full overflow-hidden">
          {/* Header */}
          <div className="border-b bg-card p-3 md:p-4 accent-left-green">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3 md:mb-4">
              {!showSegments && (
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setShowSegments(true)}
                  className="w-fit"
                >
                  <Filter className="h-4 w-4 mr-2" />
                  Show Segments
                </Button>
              )}
              <div className="flex-1 min-w-0">
                <h1 className="text-xl md:text-2xl font-bold tracking-tight truncate">Contacts</h1>
                <p className="text-xs md:text-sm text-muted-foreground truncate">
                  {selectedSegment ? selectedSegment.name : 'All contacts'} • {totalCount.toLocaleString()} total
                  {totalCount > pageSize && ` • Showing ${((currentPage - 1) * pageSize) + 1}-${Math.min(currentPage * pageSize, totalCount)}`}
                </p>
              </div>
              <div className="flex gap-2">
                <GlobalScoreRefreshButton onRefreshComplete={loadContacts} />
                <CSVImportDialog onImportComplete={loadContacts} />
                <ImportContactsDialog onImportComplete={loadContacts} />
                <AddContactDialog onContactAdded={loadContacts} />
              </div>
            </div>

          {/* Toolbar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-4">
            {contactsWithoutScores > 0 && (
              <Alert variant="default" className="mb-2 bg-warning/10 border-warning/30">
                <AlertTriangle className="h-4 w-4 text-warning" />
                <AlertDescription className="flex items-center justify-between">
                  <span className="text-sm">{contactsWithoutScores.toLocaleString()} contacts need score calculation</span>
                  <RecalculateScoresButton />
                </AlertDescription>
              </Alert>
            )}
            
            <div className="relative flex-1 max-w-full sm:max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search contacts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9"
              />
            </div>

            <div className="flex gap-2">              
              <Button
                variant={showFilters ? "default" : "outline"} 
                size="sm" 
                onClick={() => setShowFilters(!showFilters)}
                className="gap-2 flex-1 sm:flex-none"
              >
                <Filter className="h-4 w-4" />
                <span className="hidden sm:inline">Filters</span>
                {filters.length > 0 && `(${filters.length})`}
              </Button>

              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2 flex-1 sm:flex-none">
                    <Settings2 className="h-4 w-4" />
                    <span className="hidden sm:inline">Columns</span>
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
                        <label htmlFor={column.key} className="text-sm cursor-pointer flex-1">
                          {column.label}
                        </label>
                      </div>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Filter Builder */}
          {showFilters && (
            <div className="mt-4">
              <FilterBuilder 
                filters={filters} 
                onFiltersChange={setFilters}
                onSave={handleSaveSegment}
              />
            </div>
          )}
        </div>

        {/* Bulk Actions Toolbar */}
        <BulkActionsToolbar
          selectedCount={selectedContacts.size}
          totalCount={totalCount}
          onSendSMS={() => toast.info('SMS feature coming soon')}
          onSendEmail={() => toast.info('Email feature coming soon')}
          onAddTags={() => toast.info('Tags feature coming soon')}
          onExport={handleExportCSV}
          onDelete={handleDeleteSelected}
          onDeleteAll={selectedContacts.size === totalCount ? handleDeleteAll : undefined}
        />

        {/* Table */}
        <div className="flex-1 overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-background">
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={selectedContacts.size === filteredContacts.length && filteredContacts.length > 0}
                    onCheckedChange={handleSelectAll}
                  />
                </TableHead>
                {visibleColumns.map((col) => (
                  <TableHead 
                    key={col.key}
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => handleColumnSort(col.key)}
                  >
                    <div className="flex items-center gap-1">
                      {col.label}
                      {sortColumn === col.key && (
                        <span className="text-xs">
                          {sortDirection === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </div>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredContacts.map((contact) => (
                <TableRow 
                  key={contact.id} 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={(e) => {
                    if (!(e.target as HTMLElement).closest('input[type="checkbox"]')) {
                      navigate(`/contacts/${contact.id}`);
                    }
                  }}
                >
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selectedContacts.has(contact.id)}
                      onCheckedChange={() => handleSelectContact(contact.id)}
                    />
                  </TableCell>
                  {visibleColumns.map((col) => (
                    <TableCell key={col.key}>
                      {renderCellContent(contact, col.key)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
              {filteredContacts.length === 0 && (
                <TableRow>
                  <TableCell colSpan={visibleColumns.length + 1} className="text-center py-8 text-muted-foreground">
                    No contacts found. Try adjusting your filters.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination Controls */}
        {totalCount > pageSize && (
          <div className="border-t bg-card p-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  Rows per page:
                </span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                >
                  <option value={100}>100</option>
                  <option value={500}>500</option>
                  <option value={1000}>1,000</option>
                  <option value={2500}>2,500</option>
                  <option value={5000}>5,000</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  Page {currentPage} of {Math.ceil(totalCount / pageSize)} ({totalCount.toLocaleString()} total)
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                >
                  First
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(currentPage + 1)}
                  disabled={currentPage >= Math.ceil(totalCount / pageSize)}
                >
                  Next
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(Math.ceil(totalCount / pageSize))}
                  disabled={currentPage >= Math.ceil(totalCount / pageSize)}
                >
                  Last
                </Button>
              </div>
            </div>
          </div>
        )}
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    );
  };

  export default Contacts;