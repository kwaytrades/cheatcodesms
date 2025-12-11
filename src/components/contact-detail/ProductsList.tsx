import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ProductsListProps {
  contactId: string;
  totalSpent?: number;
}

export const ProductsList = ({ contactId, totalSpent }: ProductsListProps) => {
  const { data: contactProducts } = useQuery({
    queryKey: ["contact-products", contactId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contact_products")
        .select("*, products(*)")
        .eq("contact_id", contactId)
        .order("acquired_date", { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  if (!contactProducts || contactProducts.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Package className="h-4 w-4" />
            Products
          </CardTitle>
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
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Package className="h-4 w-4" />
          Products
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
      {contactProducts.filter((cp: any) => cp.products !== null).slice(0, 5).map((cp: any) => (
          <div key={cp.id} className="flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">{cp.products.name}</span>
                <Badge 
                  variant={cp.status === 'active' ? 'default' : 'secondary'}
                  className="text-xs"
                >
                  {cp.status}
                </Badge>
              </div>
              {cp.products.description && (
                <p className="text-xs text-muted-foreground line-clamp-1">
                  {cp.products.description}
                </p>
              )}
              {cp.products.price && (
                <p className="text-xs font-medium">
                  ${cp.products.price}
                </p>
              )}
            </div>
          </div>
        ))}
        {contactProducts.length > 5 && (
          <div className="text-xs text-muted-foreground pt-1">
            +{contactProducts.length - 5} more products
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
