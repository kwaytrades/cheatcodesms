import { Button } from "@/components/ui/button";
import { MessageSquare, Mail, Tag, Trash2, Download } from "lucide-react";

interface BulkActionsToolbarProps {
  selectedCount: number;
  totalCount: number;
  onSendSMS: () => void;
  onSendEmail: () => void;
  onAddTags: () => void;
  onExport: () => void;
  onDelete: () => void;
  onDeleteAll?: () => void;
}

export function BulkActionsToolbar({
  selectedCount,
  totalCount,
  onSendSMS,
  onSendEmail,
  onAddTags,
  onExport,
  onDelete,
  onDeleteAll,
}: BulkActionsToolbarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="border-b bg-muted/50 px-4 py-3">
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium">
          {selectedCount} {selectedCount === 1 ? 'contact' : 'contacts'} selected
        </span>
        <div className="h-4 w-px bg-border" />
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onSendSMS} className="gap-2">
            <MessageSquare className="h-4 w-4" />
            Send SMS
          </Button>
          <Button variant="outline" size="sm" onClick={onSendEmail} className="gap-2">
            <Mail className="h-4 w-4" />
            Send Email
          </Button>
          <Button variant="outline" size="sm" onClick={onAddTags} className="gap-2">
            <Tag className="h-4 w-4" />
            Add Tags
          </Button>
          <Button variant="outline" size="sm" onClick={onExport} className="gap-2">
            <Download className="h-4 w-4" />
            Export
          </Button>
          <Button variant="destructive" size="sm" onClick={onDelete} className="gap-2">
            <Trash2 className="h-4 w-4" />
            Delete Selected
          </Button>
          {onDeleteAll && selectedCount === totalCount && (
            <Button variant="destructive" size="sm" onClick={onDeleteAll} className="gap-2">
              <Trash2 className="h-4 w-4" />
              Delete All
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}