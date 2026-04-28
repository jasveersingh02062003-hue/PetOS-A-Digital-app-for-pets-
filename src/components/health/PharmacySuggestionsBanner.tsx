import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/hooks/useCart";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Pill, ShoppingCart } from "lucide-react";
import { toast } from "sonner";

export const PharmacySuggestionsBanner = () => {
  const { user } = useAuth();
  const { add } = useCart();

  const { data } = useQuery({
    queryKey: ["pharmacy-suggestions", user?.id ?? null],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("pharmacy_suggestions" as any)
        .select("id, med_name, dose, frequency, duration, pet_id, status, created_at")
        .eq("owner_id", user!.id)
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .limit(3);
      return (data ?? []) as any[];
    },
  });

  if (!data || data.length === 0) return null;

  const dismiss = async (id: string) => {
    await supabase.from("pharmacy_suggestions" as any).update({ status: "dismissed" }).eq("id", id);
  };

  const findInShop = async (rx: any) => {
    const term = rx.med_name.split(" ")[0];
    const { data: products } = await supabase
      .from("shop_products")
      .select("id, title, seller_id, price_inr, image_url")
      .ilike("title", `%${term}%`)
      .eq("active", true)
      .limit(1);
    if (products && products.length) {
      const p = products[0];
      add({
        product_id: p.id,
        seller_id: p.seller_id,
        title: p.title,
        price_inr: p.price_inr,
        image_url: p.image_url,
      });
      toast.success(`Added ${p.title} to cart`);
    } else {
      toast.message("Not in shop yet", { description: "Browse the shop to find a substitute." });
    }
  };

  return (
    <Card className="rounded-2xl border-hairline bg-primary-soft/40 p-3 mb-3">
      <div className="flex items-center gap-2 mb-2">
        <Pill className="h-4 w-4 text-primary" />
        <div className="text-sm font-medium">Prescribed by your vet</div>
        <Link to="/shop" className="ml-auto text-xs text-primary">Open shop</Link>
      </div>
      <ul className="space-y-2">
        {data.map((rx) => (
          <li key={rx.id} className="flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <div className="text-sm truncate">
                <span className="font-medium">{rx.med_name}</span>
                {rx.dose ? ` · ${rx.dose}` : ""}{rx.frequency ? ` · ${rx.frequency}` : ""}
              </div>
              {rx.duration && <div className="text-[11px] text-muted-foreground">{rx.duration}</div>}
            </div>
            <Button size="sm" variant="outline" className="h-8 rounded-full text-xs" onClick={() => findInShop(rx)}>
              <ShoppingCart className="h-3 w-3 mr-1" /> Buy
            </Button>
            <Button size="sm" variant="ghost" className="h-8 rounded-full text-xs" onClick={() => dismiss(rx.id)}>Done</Button>
          </li>
        ))}
      </ul>
    </Card>
  );
};
