import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Users, Sparkles, TrendingUp, Clock, AlertCircle, DollarSign, Star } from "lucide-react";
import { toast } from "sonner";

interface Segment {
  id: string;
  name: string;
  description: string | null;
  customer_count: number;
  filter_config: any;
}

interface SegmentsSidebarProps {
  onSegmentSelect: (segment: Segment | null) => void;
  selectedSegmentId: string | null;
}

const QUICK_SEGMENTS = [
  { id: 'all', name: 'All Customers', icon: Users, description: 'View all contacts' },
  { id: 'new', name: 'New This Week', icon: Sparkles, description: 'Created in last 7 days' },
  { id: 'hot', name: 'Hot Leads', icon: TrendingUp, description: 'Score 80+' },
  { id: 'at-risk', name: 'At Risk', icon: AlertCircle, description: 'Inactive 14+ days' },
  { id: 'vip', name: 'VIPs', icon: Star, description: 'High-value customers' },
  { id: 'high-spenders', name: 'High Spenders', icon: DollarSign, description: 'Spent $500+' },
];

export function SegmentsSidebar({ onSegmentSelect, selectedSegmentId }: SegmentsSidebarProps) {
  const [savedSegments, setSavedSegments] = useState<Segment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSegments();
  }, []);

  const loadSegments = async () => {
    try {
      const { data, error } = await supabase
        .from('segments')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSavedSegments(data || []);
    } catch (error) {
      console.error('Error loading segments:', error);
      toast.error('Failed to load segments');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickSegmentClick = (segmentId: string) => {
    // Map quick segment IDs to filter configs
    let filterConfig = {};
    
    switch (segmentId) {
      case 'all':
        filterConfig = {};
        break;
      case 'new':
        filterConfig = { 
          filters: [{ 
            field: 'created_at', 
            operator: 'within_days', 
            value: '7' 
          }] 
        };
        break;
      case 'hot':
        filterConfig = { 
          filters: [{ 
            field: 'lead_score', 
            operator: 'greater', 
            value: '80' 
          }] 
        };
        break;
      case 'at-risk':
        filterConfig = { 
          filters: [
            { field: 'lead_status', operator: 'equals', value: 'customer' },
            { field: 'last_contact_date', operator: 'within_days', value: '14' }
          ] 
        };
        break;
      case 'vip':
        filterConfig = { 
          filters: [{ 
            field: 'lead_status', 
            operator: 'equals', 
            value: 'vip' 
          }] 
        };
        break;
      case 'high-spenders':
        filterConfig = { 
          filters: [{ 
            field: 'total_spent', 
            operator: 'greater', 
            value: '500' 
          }] 
        };
        break;
    }

    onSegmentSelect({
      id: segmentId,
      name: QUICK_SEGMENTS.find(s => s.id === segmentId)?.name || 'All',
      description: null,
      customer_count: 0,
      filter_config: filterConfig
    });
  };

  return (
    <div className="w-60 border-r bg-card flex flex-col h-full">
      <div className="p-4 border-b">
        <h3 className="font-semibold text-sm">Segments</h3>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {/* Quick Segments */}
          <div className="pb-2 mb-2 border-b">
            <div className="px-2 py-1 text-xs font-medium text-muted-foreground">
              Quick Filters
            </div>
            {QUICK_SEGMENTS.map((segment) => {
              const Icon = segment.icon;
              return (
                <Button
                  key={segment.id}
                  variant={selectedSegmentId === segment.id ? "secondary" : "ghost"}
                  className="w-full justify-start gap-2 text-sm h-9"
                  onClick={() => handleQuickSegmentClick(segment.id)}
                >
                  <Icon className="h-4 w-4" />
                  <span className="flex-1 text-left">{segment.name}</span>
                </Button>
              );
            })}
          </div>

          {/* Saved Segments */}
          {savedSegments.length > 0 && (
            <div>
              <div className="px-2 py-1 text-xs font-medium text-muted-foreground">
                Saved Segments
              </div>
              {savedSegments.map((segment) => (
                <Button
                  key={segment.id}
                  variant={selectedSegmentId === segment.id ? "secondary" : "ghost"}
                  className="w-full justify-between gap-2 text-sm h-9"
                  onClick={() => onSegmentSelect(segment)}
                >
                  <span className="flex-1 text-left truncate">{segment.name}</span>
                  {segment.customer_count > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      {segment.customer_count}
                    </Badge>
                  )}
                </Button>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>

      {loading && (
        <div className="p-4 text-center text-sm text-muted-foreground">
          Loading segments...
        </div>
      )}
    </div>
  );
}