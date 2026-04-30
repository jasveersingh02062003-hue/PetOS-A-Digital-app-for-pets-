import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, ShoppingBag, ShoppingCart } from "lucide-react";
import { useCart } from "@/hooks/useCart";
import { WishlistButton } from "@/components/marketplace/WishlistButton";
import { PriceTag } from "@/components/marketplace/PriceTag";
import { ReviewsList, RatingChip } from "@/components/reviews/ReviewsList";
import { toast } from "sonner";

const ProductDetail = () => {
  const { id = "" } = useParams<{ id: string }>();
  const nav = useNavigate();
  const { add } = useCart();

  const { data: p, isLoading } = useQuery({
    queryKey: ["product", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shop_products")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: related = [] } = useQuery({
    queryKey: ["product-related", p?.seller_id, id],
    enabled: !!p?.seller_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("shop_products")
        .select("id, title, price_inr, image_url")
        .eq("seller_id", p!.seller_id)
        .eq("active", true)
        .neq("id", id)
        .limit(6);
      return data ?? [];
    },
  });

  if (isLoading) return <div className="container-app py-10 text-sm">Loading…</div>;
  if (!p) return <div className="container-app py-10 text-sm">Product not found.</div>;

  const inStock = (p.stock ?? 0) > 0;

  const addToCart = () => {
    add({
      product_id: p.id,
      seller_id: p.seller_id,
      title: p.title,
      price_inr: p.price_inr,
      image_url: p.image_url,
    });
    toast.success("Added to cart");
  };

  return (
    <div className="container-app pad-top-safe pb-32 max-w-2xl">
      <header className="pt-4 pb-3 flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => nav(-1)} aria-label="Back">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="font-display text-lg truncate flex-1">{p.title}</h1>
        <WishlistButton listingId={p.id} kind="product" />
      </header>

      <div className="relative aspect-square rounded-2xl bg-muted overflow-hidden">
        {p.image_url ? (
          <img src={p.image_url} alt={p.title} className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full grid place-items-center text-muted-foreground">No image</div>
        )}
        {!inStock && (
          <div className="absolute bottom-2 left-2 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-destructive text-destructive-foreground">
            Out of stock
          </div>
        )}
      </div>

      <div className="mt-4 space-y-2">
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">{p.category}</div>
        <h2 className="font-display text-2xl leading-tight">{p.title}</h2>
        <div className="flex items-center gap-3">
          <PriceTag amount={p.price_inr} />
          <RatingChip subjectType="product" subjectId={p.id} />
        </div>
        {p.description && (
          <p className="text-sm text-muted-foreground whitespace-pre-wrap pt-2">{p.description}</p>
        )}
      </div>

      {related.length > 0 && (
        <section className="mt-8">
          <h3 className="font-display text-base mb-3">More from this seller</h3>
          <div className="grid grid-cols-3 gap-2">
            {related.map((r: any) => (
              <Link
                key={r.id}
                to={`/shop/${r.id}`}
                className="rounded-xl border border-hairline overflow-hidden bg-card"
              >
                <div className="aspect-square bg-muted overflow-hidden">
                  {r.image_url && <img src={r.image_url} alt={r.title} className="h-full w-full object-cover" />}
                </div>
                <div className="p-2">
                  <div className="text-[11px] line-clamp-2">{r.title}</div>
                  <div className="text-xs font-medium mt-0.5">₹{r.price_inr}</div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="mt-8">
        <h3 className="font-display text-base mb-3">Reviews</h3>
        <ReviewsList subjectType="product" subjectId={p.id} />
      </section>

      <div className="fixed bottom-0 inset-x-0 bg-background/95 backdrop-blur border-t border-hairline p-3 pad-bottom-safe">
        <div className="container-app max-w-2xl flex items-center gap-2">
          <Button
            variant="outline"
            className="flex-1 rounded-full h-12"
            disabled={!inStock}
            onClick={addToCart}
          >
            <ShoppingCart className="h-4 w-4 mr-2" /> Add to cart
          </Button>
          <Button
            className="flex-1 rounded-full h-12"
            disabled={!inStock}
            onClick={() => { addToCart(); nav("/cart"); }}
          >
            <ShoppingBag className="h-4 w-4 mr-2" /> Buy now
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ProductDetail;
