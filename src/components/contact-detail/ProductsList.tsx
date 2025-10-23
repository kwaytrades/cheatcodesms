import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2 } from "lucide-react";

interface ProductsListProps {
  productsOwned?: string[] | null;
  totalSpent?: number;
}

export const ProductsList = ({ productsOwned, totalSpent }: ProductsListProps) => {
  if (!productsOwned || productsOwned.length === 0) {
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
        {productsOwned.slice(0, 5).map((product, index) => (
          <div key={index} className="flex items-start gap-2 text-sm">
            <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="font-medium">{product}</div>
            </div>
          </div>
        ))}
        {productsOwned.length > 5 && (
          <div className="text-xs text-muted-foreground pt-1">
            +{productsOwned.length - 5} more products
          </div>
        )}
        {totalSpent && totalSpent > 0 && (
          <div className="text-xs text-muted-foreground pt-2 border-t">
            Total Spent: <span className="font-semibold text-green-600">${totalSpent.toLocaleString()}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
