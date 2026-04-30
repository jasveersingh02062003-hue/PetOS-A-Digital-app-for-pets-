import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useWishlistList } from "@/hooks/useWishlist";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Heart } from "lucide-react";
import { EmptyState } from "@/components/empty/EmptyState";

const KIND_ROUTE: Record<string, (id: string) => string> = {
  pet: (id) => `/mates/adopt/${id}`,
  product: (id) => `/shop/${id}`,
  service: (id) => `/services/${id}`,
  vet: (id) => `/book-vet?vet=${id}`,
};

const KIND_LABEL: Record<string, string> = {
  pet: "Pet listing",
  product: "Shop product",
  service: "Service",
  vet: "Vet",
};

const Wishlist = () => {
  const nav = useNavigate();
  const { user } = useAuth();
  const { data: items = [], isLoading } = useWishlistList(user?.id);

  return (
    <div className="container-app pad-top-safe pb-24 max-w-2xl">
      <header className="pt-4 pb-4 flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => nav(-1)} aria-label="Back">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="font-display text-2xl">Wishlist</h1>
      </header>

      {!user ? (
        <EmptyState
          icon={Heart}
          title="Sign in to see your saves"
          description="Save listings, products, vets and services from anywhere with the heart icon."
          ctaLabel="Sign in"
          onCta={() => nav("/auth")}
        />
      ) : isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : items.length === 0 ? (
        <EmptyState
          icon={Heart}
          title="Nothing saved yet"
          description="Tap the heart on any listing to save it here for later."
          ctaLabel="Browse shop"
          onCta={() => nav("/shop")}
        />
      ) : (
        <div className="space-y-2">
          {items.map((it: any) => {
            const route = (KIND_ROUTE[it.kind] ?? KIND_ROUTE.pet)(it.listing_id);
            return (
              <Card
                key={it.id}
                className="rounded-2xl border-hairline p-3 flex items-center gap-3 cursor-pointer hover:shadow-[var(--shadow-card)]"
                onClick={() => nav(route)}
              >
                <div className="h-10 w-10 rounded-full bg-primary-soft grid place-items-center">
                  <Heart className="h-4 w-4 text-coral" fill="currentColor" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium capitalize">{KIND_LABEL[it.kind] ?? it.kind}</div>
                  <div className="text-[11px] text-muted-foreground">
                    Saved {new Date(it.created_at).toLocaleDateString()}
                  </div>
                </div>
                <Button size="sm" variant="outline" className="rounded-full">Open</Button>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Wishlist;
