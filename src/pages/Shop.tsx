import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Plus, ShoppingCart, Package } from "lucide-react";
import { useState } from "react";
import { useCart } from "@/hooks/useCart";
import type { Database } from "@/integrations/supabase/types";

type ProductCategory = Database["public"]["Enums"]["product_category"];

const cats: { key: ProductCategory | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "food", label: "Food" },
  { key: "toys", label: "Toys" },
  { key: "accessories", label: "Accessories" },
  { key: "health", label: "Health" },
  { key: "grooming", label: "Grooming" },
];

const Shop = () => {
  const nav = useNavigate();
  const [cat, setCat] = useState<ProductCategory | "all">("all");
  const { add, count } = useCart();

  const { data: products, isLoading } = useQuery({
    queryKey: ["shop_products", cat],
    queryFn: async () => {
      let q = supabase
        .from("shop_products")
        .select("*")
        .eq("active", true)
        .order("created_at", { ascending: false })
        .limit(60);
      if (cat !== "all") q = q.eq("category", cat);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="container-app pad-top-safe pb-24">
      <header className="pt-4 pb-4 flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => nav(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="font-display text-2xl flex-1">Shop</h1>
        <Button asChild variant="outline" size="icon" className="rounded-full relative">
          <Link to="/cart">
            <ShoppingCart className="h-4 w-4" />
            {count > 0 && (
              <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-[10px] rounded-full h-5 min-w-5 px-1 flex items-center justify-center font-medium">
                {count}
              </span>
            )}
          </Link>
        </Button>
        <Button asChild size="icon" className="rounded-full">
          <Link to="/shop/new">
            <Plus className="h-4 w-4" />
          </Link>
        </Button>
      </header>

      <div className="flex gap-2 overflow-x-auto pb-3 -mx-1 px-1 no-scrollbar">
        {cats.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setCat(key)}
            className={`rounded-full border px-3 py-1.5 text-sm whitespace-nowrap ${
              cat === key
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card border-hairline hover:bg-muted"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {!isLoading && (products?.length ?? 0) === 0 && (
        <Card className="rounded-2xl border-hairline p-6 text-center text-sm text-muted-foreground">
          No products yet.
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3">
        {products?.map((p) => (
          <Card key={p.id} className="rounded-2xl border-hairline overflow-hidden p-0 flex flex-col">
            <div className="aspect-square bg-muted flex items-center justify-center overflow-hidden">
              {p.image_url ? (
                <img src={p.image_url} alt={p.title} className="h-full w-full object-cover" />
              ) : (
                <Package className="h-8 w-8 text-muted-foreground" strokeWidth={1.5} />
              )}
            </div>
            <div className="p-3 flex-1 flex flex-col">
              <div className="text-sm font-medium line-clamp-2 leading-tight">{p.title}</div>
              <div className="text-xs text-muted-foreground capitalize mt-0.5">{p.category}</div>
              <div className="mt-auto pt-2 flex items-center justify-between">
                <div className="font-display text-base">₹{p.price_inr}</div>
                <Button
                  size="sm"
                  className="rounded-full h-8 px-3 text-xs"
                  onClick={() =>
                    add({
                      product_id: p.id,
                      seller_id: p.seller_id,
                      title: p.title,
                      price_inr: p.price_inr,
                      image_url: p.image_url,
                    })
                  }
                  disabled={p.stock <= 0}
                >
                  {p.stock <= 0 ? "Out" : "Add"}
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default Shop;
