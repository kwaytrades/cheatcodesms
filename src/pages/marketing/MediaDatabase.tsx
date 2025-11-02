import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Upload, Download, Grid3x3, Table as TableIcon, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { FilterBuilder, FilterCondition } from "@/components/FilterBuilder";
import { InfluencerCard } from "@/components/marketing/InfluencerCard";
import { AddContactDialog } from "@/components/AddContactDialog";
import { CSVImportDialog } from "@/components/CSVImportDialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

export function MediaDatabase() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [filters, setFilters] = useState<FilterCondition[]>([]);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [quickFiltersOpen, setQuickFiltersOpen] = useState(true);
  const [platformType, setPlatformType] = useState<string>("all");
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>([]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  
  const handleContactAdded = () => {
    queryClient.invalidateQueries({ queryKey: ["influencers"] });
  };
  
  const handleImportComplete = () => {
    queryClient.invalidateQueries({ queryKey: ["influencers"] });
  };

  const { data: influencers, isLoading } = useQuery({
    queryKey: ["influencers", searchQuery, filters, platformType, selectedCompanies],
    queryFn: async () => {
      let query = supabase
        .from("contacts")
        .select("*")
        .not("platform", "is", null);

      if (searchQuery) {
        query = query.or(`full_name.ilike.%${searchQuery}%,platform_handle.ilike.%${searchQuery}%`);
      }

      // Filter by platform type
      if (platformType !== "all") {
        query = query.eq("platform", platformType);
      }

      // Filter by company for news outlets
      if (platformType === "news" && selectedCompanies.length > 0) {
        const companyFilters = selectedCompanies.map(company => `tags.cs.{${company}}`).join(',');
        query = query.or(companyFilters);
      }

      filters.forEach((filter) => {
        const value = Array.isArray(filter.value) ? filter.value[0] : filter.value;
        if (filter.field === "follower_count" && filter.operator === "gte") {
          query = query.gte("follower_count", parseInt(value));
        } else if (filter.field === "engagement_rate" && filter.operator === "gte") {
          query = query.gte("engagement_rate", parseFloat(value));
        } else if (filter.field === "platform") {
          query = query.eq("platform", value);
        } else if (filter.field === "influencer_tier") {
          query = query.eq("influencer_tier", value);
        }
      });

      const { data, error } = await query.order("follower_count", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const newsCompanies = [
    "Bloomberg",
    "Fox News",
    "CNBC",
    "Reuters",
    "CNN",
    "Financial Times",
    "Wall Street Journal",
    "MarketWatch",
    "Seeking Alpha",
  ];

  const toggleCompany = (company: string) => {
    setSelectedCompanies(prev =>
      prev.includes(company)
        ? prev.filter(c => c !== company)
        : [...prev, company]
    );
  };

  const quickFilters = [
    {
      label: "Micro Influencers (10K-100K)",
      filters: [
        { id: "1", field: "follower_count", operator: "gte", value: "10000" },
        { id: "2", field: "follower_count", operator: "lte", value: "100000" },
      ],
    },
    {
      label: "TikTok 50K+",
      filters: [
        { id: "1", field: "platform", operator: "eq", value: "tiktok" },
        { id: "2", field: "follower_count", operator: "gte", value: "50000" },
      ],
    },
    {
      label: "High Engagement (>5%)",
      filters: [{ id: "1", field: "engagement_rate", operator: "gte", value: "5" }],
    },
  ];

  return (
    <div className="space-y-6">
      {/* Platform Type Tabs */}
      <Tabs value={platformType} onValueChange={setPlatformType} className="w-full">
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="instagram">Instagram</TabsTrigger>
          <TabsTrigger value="tiktok">TikTok</TabsTrigger>
          <TabsTrigger value="youtube">YouTube</TabsTrigger>
          <TabsTrigger value="twitter">Twitter</TabsTrigger>
          <TabsTrigger value="news">News</TabsTrigger>
          <TabsTrigger value="blog">Blog</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Top Actions Bar */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search influencers by name or handle..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button onClick={() => setShowAddDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Influencer
        </Button>
        <Button variant="outline" onClick={() => setShowImportDialog(true)}>
          <Upload className="h-4 w-4 mr-2" />
          Import CSV
        </Button>
        <Button variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
        <div className="flex border rounded-md">
          <Button
            variant={viewMode === "grid" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setViewMode("grid")}
          >
            <Grid3x3 className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === "table" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setViewMode("table")}
          >
            <TableIcon className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex gap-0 relative">
        {/* Filter Sidebar */}
        <div 
          className={`border-r bg-background transition-all duration-300 ease-in-out ${
            sidebarCollapsed ? 'w-0 overflow-hidden' : 'w-[300px]'
          }`}
        >
          <div className="p-4 space-y-4">
            <Collapsible open={quickFiltersOpen} onOpenChange={setQuickFiltersOpen}>
              <CollapsibleTrigger className="flex items-center justify-between w-full mb-3 hover:opacity-80 transition-opacity">
                <h3 className="font-semibold">Quick Filters</h3>
                <ChevronDown className={`h-4 w-4 transition-transform ${quickFiltersOpen ? 'rotate-180' : ''}`} />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="space-y-2 mb-4">
                  {quickFilters.map((qf) => (
                    <Button
                      key={qf.label}
                      variant="outline"
                      size="sm"
                      className="w-full justify-start"
                      onClick={() => setFilters(qf.filters)}
                    >
                      {qf.label}
                    </Button>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* Company Filter for News */}
            {platformType === "news" && (
              <div className="space-y-3 border rounded-lg p-4">
                <h3 className="font-semibold text-sm">News Organizations</h3>
                <div className="space-y-2">
                  {newsCompanies.map((company) => (
                    <div key={company} className="flex items-center space-x-2">
                      <Checkbox
                        id={company}
                        checked={selectedCompanies.includes(company)}
                        onCheckedChange={() => toggleCompany(company)}
                      />
                      <Label htmlFor={company} className="text-sm cursor-pointer">
                        {company}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <FilterBuilder filters={filters} onFiltersChange={setFilters} />
          </div>
        </div>

        {/* Collapse/Expand Button */}
        <Button
          variant="ghost"
          size="icon"
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 h-16 w-8 rounded-r-md rounded-l-none border-l-0"
          style={{ left: sidebarCollapsed ? '0' : '300px' }}
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
        >
          {sidebarCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>

        {/* Contact Grid */}
        <div className="flex-1 p-6">
          {isLoading ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} className="h-64 rounded-lg" />
              ))}
            </div>
          ) : viewMode === "grid" ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {influencers?.map((influencer) => (
                <InfluencerCard key={influencer.id} influencer={influencer} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              Table view coming soon
            </div>
          )}

          {!isLoading && influencers?.length === 0 && (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No influencers found</p>
            </div>
          )}
        </div>
      </div>

      <AddContactDialog 
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        onContactAdded={handleContactAdded}
        skipNavigation={true}
      />
      <CSVImportDialog 
        open={showImportDialog}
        onOpenChange={setShowImportDialog}
        onImportComplete={handleImportComplete}
      />
    </div>
  );
}
