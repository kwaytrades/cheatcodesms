import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Upload, Download, Grid3x3, Table as TableIcon } from "lucide-react";
import { FilterBuilder, FilterCondition } from "@/components/FilterBuilder";
import { InfluencerCard } from "@/components/marketing/InfluencerCard";
import { AddContactDialog } from "@/components/AddContactDialog";
import { CSVImportDialog } from "@/components/CSVImportDialog";
import { Skeleton } from "@/components/ui/skeleton";

export function MediaDatabase() {
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [filters, setFilters] = useState<FilterCondition[]>([]);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);

  const { data: influencers, isLoading } = useQuery({
    queryKey: ["influencers", searchQuery, filters],
    queryFn: async () => {
      let query = supabase
        .from("contacts")
        .select("*")
        .not("platform", "is", null);

      if (searchQuery) {
        query = query.or(`full_name.ilike.%${searchQuery}%,platform_handle.ilike.%${searchQuery}%`);
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

      <div className="grid md:grid-cols-[300px_1fr] gap-6">
        {/* Filter Sidebar */}
        <div className="space-y-4">
          <div>
            <h3 className="font-semibold mb-3">Quick Filters</h3>
            <div className="space-y-2">
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
          </div>
          <FilterBuilder filters={filters} onFiltersChange={setFilters} />
        </div>

        {/* Contact Grid */}
        <div>
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

      {showAddDialog && <AddContactDialog onContactAdded={() => setShowAddDialog(false)} />}
      {showImportDialog && <CSVImportDialog onImportComplete={() => setShowImportDialog(false)} />}
    </div>
  );
}
