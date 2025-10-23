import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, DollarSign, Calendar, Package } from "lucide-react";
import { format } from "date-fns";

interface ChargebackHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactName: string;
  disputedAmount: number;
  hasDisputed: boolean;
  productsOwned?: string[];
  lastContactDate?: string;
}

export const ChargebackHistoryDialog = ({
  open,
  onOpenChange,
  contactName,
  disputedAmount,
  hasDisputed,
  productsOwned,
  lastContactDate
}: ChargebackHistoryDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            SHITLIST - Chargeback History
          </DialogTitle>
          <DialogDescription>
            Detailed information about disputes for {contactName}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {/* Warning Banner */}
          <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold text-destructive">High Risk Contact</p>
                <p className="text-sm text-muted-foreground">
                  This contact has disputed charges and should be approached with caution.
                </p>
              </div>
            </div>
          </div>

          {/* Dispute Details */}
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Total Disputed Amount</span>
              </div>
              <span className="text-lg font-bold text-destructive">
                ${disputedAmount.toLocaleString()}
              </span>
            </div>

            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Dispute Status</span>
              </div>
              <Badge variant="destructive">
                {hasDisputed ? "Active Dispute" : "Resolved"}
              </Badge>
            </div>

            {lastContactDate && (
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Last Contact</span>
                </div>
                <span className="text-sm">
                  {format(new Date(lastContactDate), "MMM dd, yyyy")}
                </span>
              </div>
            )}

            {productsOwned && productsOwned.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  Products Involved
                </div>
                <div className="flex flex-wrap gap-2 p-3 bg-muted rounded-lg">
                  {productsOwned.map((product, idx) => (
                    <Badge key={idx} variant="outline" className="text-xs">
                      {product}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Action Notes */}
          <div className="bg-warning/10 border border-warning/30 rounded-lg p-4">
            <p className="text-sm font-medium text-warning mb-2">⚠️ Recommended Actions:</p>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li>Do not offer new products or services</li>
              <li>Flag for manual review before any transactions</li>
              <li>Document all communications carefully</li>
              <li>Consider removing from marketing campaigns</li>
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
