import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X, Plus } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";

export interface FilterCondition {
  id: string;
  field: string;
  operator: string;
  value: string | string[];
}

interface FilterBuilderProps {
  filters: FilterCondition[];
  onFiltersChange: (filters: FilterCondition[]) => void;
  onSave?: (name: string, description: string) => void;
}

const FILTER_FIELDS = [
  { value: 'full_name', label: 'Name', type: 'text' },
  { value: 'email', label: 'Email', type: 'text' },
  { value: 'phone_number', label: 'Phone', type: 'text' },
  { value: 'customer_tier', label: 'Customer Tier', type: 'select', options: ['LEAD', 'Level 1', 'Level 2', 'Level 3', 'VIP', 'SHITLIST'] },
  { value: 'likelihood_category', label: 'Lead Status', type: 'select', options: ['hot', 'warm', 'neutral', 'cold', 'frozen'] },
  { value: 'likelihood_to_buy_score', label: 'Likelihood Score', type: 'number' },
  { value: 'lead_score', label: 'Engagement Score', type: 'number' },
  { value: 'engagement_score', label: 'Engagement Level', type: 'number' },
  { value: 'products_owned', label: 'Products Owned', type: 'array' },
  { value: 'tags', label: 'Tags', type: 'array' },
  { value: 'trading_experience', label: 'Trading Experience', type: 'select', options: ['beginner', 'intermediate', 'advanced'] },
  { value: 'trading_style', label: 'Trading Style', type: 'select', options: ['day-trading', 'swing', 'position', 'long-term'] },
  { value: 'account_size', label: 'Account Size', type: 'select', options: ['<5k', '5k-25k', '25k-100k', '100k+'] },
  { value: 'total_spent', label: 'Total Spent', type: 'number' },
  { value: 'has_disputed', label: 'Has Disputes', type: 'select', options: ['true', 'false'] },
  { value: 'last_contact_date', label: 'Last Activity', type: 'date' },
];

const TEXT_OPERATORS = [
  { value: 'contains', label: 'contains' },
  { value: 'equals', label: 'equals' },
  { value: 'not_equals', label: 'does not equal' },
];

const NUMBER_OPERATORS = [
  { value: 'equals', label: 'equals' },
  { value: 'greater', label: 'greater than' },
  { value: 'less', label: 'less than' },
  { value: 'between', label: 'between' },
];

const ARRAY_OPERATORS = [
  { value: 'includes', label: 'includes' },
  { value: 'not_includes', label: 'does not include' },
  { value: 'includes_all', label: 'includes all of' },
];

const DATE_OPERATORS = [
  { value: 'within_days', label: 'within last X days' },
  { value: 'before', label: 'before date' },
  { value: 'after', label: 'after date' },
];

export function FilterBuilder({ filters, onFiltersChange, onSave }: FilterBuilderProps) {
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [segmentName, setSegmentName] = useState('');
  const [segmentDescription, setSegmentDescription] = useState('');

  const addFilter = () => {
    onFiltersChange([
      ...filters,
      { id: crypto.randomUUID(), field: 'full_name', operator: 'contains', value: '' }
    ]);
  };

  const removeFilter = (id: string) => {
    onFiltersChange(filters.filter(f => f.id !== id));
  };

  const updateFilter = (id: string, updates: Partial<FilterCondition>) => {
    onFiltersChange(filters.map(f => f.id === id ? { ...f, ...updates } : f));
  };

  const getOperatorsForField = (field: string) => {
    const fieldConfig = FILTER_FIELDS.find(f => f.value === field);
    if (!fieldConfig) return TEXT_OPERATORS;
    
    switch (fieldConfig.type) {
      case 'number':
        return NUMBER_OPERATORS;
      case 'array':
        return ARRAY_OPERATORS;
      case 'date':
        return DATE_OPERATORS;
      case 'select':
      case 'text':
      default:
        return TEXT_OPERATORS;
    }
  };

  const handleSave = () => {
    if (!segmentName.trim()) {
      toast.error("Segment name is required");
      return;
    }
    onSave?.(segmentName, segmentDescription);
    setSaveDialogOpen(false);
    setSegmentName('');
    setSegmentDescription('');
  };

  return (
    <div className="space-y-3 p-4 border rounded-lg bg-card">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">Filters</h4>
        <Button onClick={addFilter} variant="ghost" size="sm" className="gap-2">
          <Plus className="h-3 w-3" />
          Add Filter
        </Button>
      </div>

      {/* Quick Filters */}
      <div className="flex flex-wrap gap-2 pb-2 border-b">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            onFiltersChange([
              { id: crypto.randomUUID(), field: 'likelihood_category', operator: 'equals', value: 'hot' }
            ]);
          }}
          className="text-xs"
        >
          🔥 Hot Leads
        </Button>
        <Button variant="outline" size="sm" onClick={() => onFiltersChange([{ id: crypto.randomUUID(), field: 'likelihood_category', operator: 'equals', value: 'hot' }])} className="text-xs">
          🔥 Hot Leads
        </Button>
        <Button variant="outline" size="sm" onClick={() => onFiltersChange([{ id: crypto.randomUUID(), field: 'likelihood_category', operator: 'equals', value: 'warm' }])} className="text-xs">
          🟡 Warm Leads
        </Button>
        <Button variant="outline" size="sm" onClick={() => onFiltersChange([{ id: crypto.randomUUID(), field: 'likelihood_category', operator: 'equals', value: 'cold' }])} className="text-xs">
          ❄️ Cold Leads
        </Button>
        <Button variant="outline" size="sm" onClick={() => onFiltersChange([{ id: crypto.randomUUID(), field: 'customer_tier', operator: 'equals', value: 'Level 1' }])} className="text-xs">
          Level 1
        </Button>
        <Button variant="outline" size="sm" onClick={() => onFiltersChange([{ id: crypto.randomUUID(), field: 'customer_tier', operator: 'equals', value: 'Level 2' }])} className="text-xs">
          Level 2
        </Button>
        <Button variant="outline" size="sm" onClick={() => onFiltersChange([{ id: crypto.randomUUID(), field: 'customer_tier', operator: 'equals', value: 'Level 3' }])} className="text-xs">
          Level 3
        </Button>
        <Button variant="outline" size="sm" onClick={() => onFiltersChange([{ id: crypto.randomUUID(), field: 'customer_tier', operator: 'equals', value: 'VIP' }])} className="text-xs">
          👑 VIP Only
        </Button>
        <Button variant="outline" size="sm" onClick={() => onFiltersChange([{ id: crypto.randomUUID(), field: 'total_spent', operator: 'greater', value: '1000' }])} className="text-xs">
          💰 High Spenders
        </Button>
        <Button variant="outline" size="sm" onClick={() => onFiltersChange([{ id: crypto.randomUUID(), field: 'customer_tier', operator: 'equals', value: 'SHITLIST' }])} className="text-xs">
          ⚠️ SHITLIST
        </Button>
        <Button variant="outline" size="sm" onClick={() => onFiltersChange([{ id: crypto.randomUUID(), field: 'likelihood_to_buy_score', operator: 'greater', value: '70' }])} className="text-xs">
          📈 High Likelihood
        </Button>
      </div>

      {filters.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          No filters applied. Click "Add Filter" to get started.
        </p>
      ) : (
        <div className="space-y-2">
          {filters.map((filter, index) => {
            const fieldConfig = FILTER_FIELDS.find(f => f.value === filter.field);
            
            return (
              <div key={filter.id} className="space-y-2">
                {index > 0 && (
                  <div className="text-xs font-medium text-muted-foreground pl-2">AND</div>
                )}
                <div className="flex items-center gap-2">
                  <Select 
                    value={filter.field} 
                    onValueChange={(value) => updateFilter(filter.id, { field: value, operator: 'contains', value: '' })}
                  >
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FILTER_FIELDS.map(field => (
                        <SelectItem key={field.value} value={field.value}>{field.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select 
                    value={filter.operator} 
                    onValueChange={(value) => updateFilter(filter.id, { operator: value })}
                  >
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {getOperatorsForField(filter.field).map(op => (
                        <SelectItem key={op.value} value={op.value}>{op.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {fieldConfig?.type === 'select' && fieldConfig.options ? (
                    <Select 
                      value={filter.value as string} 
                      onValueChange={(value) => updateFilter(filter.id, { value })}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Select value" />
                      </SelectTrigger>
                      <SelectContent>
                        {fieldConfig.options.map(option => (
                          <SelectItem key={option} value={option}>{option}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      className="flex-1"
                      placeholder="Value"
                      value={filter.value as string}
                      onChange={(e) => updateFilter(filter.id, { value: e.target.value })}
                      type={fieldConfig?.type === 'number' ? 'number' : 'text'}
                    />
                  )}

                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => removeFilter(filter.id)}
                    className="px-2"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex items-center justify-between pt-2 border-t">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => onFiltersChange([])}
          disabled={filters.length === 0}
        >
          Clear All
        </Button>
        
        <div className="flex gap-2">
          {onSave && (
            <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" disabled={filters.length === 0}>
                  Save as Segment
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Save Segment</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="segment-name">Segment Name *</Label>
                    <Input
                      id="segment-name"
                      value={segmentName}
                      onChange={(e) => setSegmentName(e.target.value)}
                      placeholder="e.g., Hot Leads"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="segment-description">Description (optional)</Label>
                    <Input
                      id="segment-description"
                      value={segmentDescription}
                      onChange={(e) => setSegmentDescription(e.target.value)}
                      placeholder="e.g., Leads with score 80+"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleSave}>Save Segment</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>
    </div>
  );
}