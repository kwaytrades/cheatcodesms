import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2 } from "lucide-react";

interface Purchase {
  id: string;
  amount: number;
  purchase_date: string;
  products?: {
    name: string;
  };
}

interface ProductsListProps {
  purchases: Purchase[];
}

export const ProductsList = ({ purchases }: ProductsListProps) => {
  if (purchases.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">🛍️ Products</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No purchases yet</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">🛍️ Products</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {purchases.slice(0, 3).map((purchase) => (
          <div key={purchase.id} className="flex items-start gap-2 text-sm">
            <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">
                {purchase.products?.name || "Product"}
              </div>
              <div className="text-xs text-muted-foreground">
                ${purchase.amount.toLocaleString()} · {new Date(purchase.purchase_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </div>
            </div>
          </div>
        ))}
        {purchases.length > 3 && (
          <div className="text-xs text-muted-foreground pt-1">
            +{purchases.length - 3} more products
          </div>
        )}
      </CardContent>
    </Card>
  );
};
