import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";

const Orders = () => {
  const nav = useNavigate();
  const { user } = useAuth();

  const { data: orders } = useQuery({
    queryKey: ["my-orders", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shop_orders")
        .select("*, shop_order_items(*)")
        .eq("customer_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  return (
    <div className="container-app pad-top-safe pb-24">
      <header className="pt-4 pb-4 flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => nav(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="font-display text-2xl">My orders</h1>
      </header>
      {(orders?.length ?? 0) === 0 && (
        <Card className="rounded-2xl border-hairline p-6 text-center text-sm text-muted-foreground">
          No orders yet.
        </Card>
      )}
      <div className="space-y-3">
        {orders?.map((o: any) => (
          <Card key={o.id} className="rounded-2xl border-hairline p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">
                {new Date(o.created_at).toLocaleDateString()}
              </span>
              <span className="text-xs rounded-full bg-muted px-2 py-1 capitalize">
                {o.status}
              </span>
            </div>
            <div className="text-sm space-y-1">
              {o.shop_order_items?.map((it: any) => (
                <div key={it.id} className="flex justify-between">
                  <span className="truncate">{it.title_snapshot} × {it.qty}</span>
                  <span>₹{it.unit_price_inr * it.qty}</span>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-hairline">
              <span className="text-sm text-muted-foreground">Total</span>
              <span className="font-display text-lg">₹{o.total_inr}</span>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default Orders;
