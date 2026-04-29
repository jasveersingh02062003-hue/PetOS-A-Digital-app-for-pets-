import { lazy, Suspense, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Heart, Search as SearchIcon, PawPrint, Building2, Loader2 } from "lucide-react";
import { useSeo } from "@/hooks/useSeo";
import { SellerBadge } from "@/components/SellerBadge";
import { KpiCard } from "./dashboard/KpiCard";
import { PostFeed } from "@/components/PostFeed";
import { EmptyState } from "@/components/EmptyState";
import { listSavedSearches } from "@/lib/savedSearches";

const StoryRail = lazy(() =>
  import("@/components/social/StoryRail").then((m) => ({ default: m.StoryRail })),
);

/**
 * Real-data buyer dashboard.
 *
 * Live queries:
 *  - Saved searches: localStorage (existing system)
 *  - Recommended adoptables: pet_listings active, listing_type='adoption', limit 5
 *  - Breeders nearby: profiles where account_type='breeder' (limit 5)
 */
const BuyerHome = () => {
  const nav = useNavigate();
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const uid = user?.id;
  const firstName = profile?.full_name?.split(" ")[0];

  useSeo({ title: "Buyer hub", description: "Discover adoptables and breeders.", noIndex: true });

  // Saved searches live in localStorage
  const [savedCount, setSavedCount] = useState(0);
  useEffect(() => {
    try {
      setSavedCount(listSavedSearches().length);
    } catch {
      setSavedCount(0);
    }
  }, []);

  const adoptables = useQuery({
    queryKey: ["buyer-adopt-recommended"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pet_listings")
        .select("id, title, photos, city, fee_inr, breed, species")
        .eq("active", true)
        .eq("listing_type", "adoption")
        .order("created_at", { ascending: false })
        .limit(6);
      if (error) throw error;
      return data ?? [];
    },
  });

  const breeders = useQuery({
    queryKey: ["buyer-breeders-nearby"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url, city")
        .eq("account_type", "breeder")
        .limit(6);
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div className="container-app pad-top-safe">
      <header className="pt-6 pb-4">
        <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">
          {new Date().toLocaleDateString(undefined, { weekday: "long" })}
        </div>
        <div className="flex items-center justify-between gap-3 mt-1">
          <h1 className="font-display text-[28px] leading-tight">
            {firstName ? <>Hi, <span className="text-primary">{firstName}</span></> : "Welcome"}
          </h1>
          <SellerBadge type="buyer" />
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3">
        <KpiCard
          label="Saved searches"
          value={savedCount}
          icon={SearchIcon}
          to="/discover"
          tint="bg-primary/5"
        />
        <KpiCard
          label="Adoptables"
          value={adoptables.data?.length ?? 0}
          sub="recommended"
          loading={adoptables.isLoading}
          icon={PawPrint}
          to="/mates"
          tint="bg-coral/10"
        />
        <KpiCard
          label="Breeders"
          value={breeders.data?.length ?? 0}
          sub="verified"
          loading={breeders.isLoading}
          icon={Building2}
          to="/breeders"
          tint="bg-amber-500/10"
        />
        <KpiCard label="Discover" value="Open" icon={Heart} to="/discover" tint="bg-lilac/10" />
      </div>

      <div className="flex flex-wrap gap-2 mt-4">
        <Button size="sm" onClick={() => nav("/mates")} className="rounded-full">
          Browse adopt
        </Button>
        <Button size="sm" variant="outline" onClick={() => nav("/breeders")} className="rounded-full">
          Browse breeders
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => window.dispatchEvent(new CustomEvent("petos:open-composer"))}
          className="rounded-full"
        >
          Post wanted
        </Button>
      </div>

      {/* Recommended adoptables */}
      <Card className="rounded-2xl border-hairline shadow-none p-4 mt-4">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-semibold">Recommended adoptables</div>
          <Link to="/mates" className="text-xs font-medium text-primary hover:underline">
            View all
          </Link>
        </div>
        {adoptables.isLoading ? (
          <div className="py-6 grid place-items-center">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : !adoptables.data?.length ? (
          <p className="text-sm text-muted-foreground py-4">No listings yet.</p>
        ) : (
          <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-1 px-1">
            {adoptables.data.map((l: any) => (
              <Link
                key={l.id}
                to={`/mates/adopt/${l.id}`}
                className="shrink-0 w-32 rounded-xl bg-card border border-hairline overflow-hidden"
              >
                <div className="aspect-square bg-muted">
                  {l.photos?.[0] ? (
                    <img src={l.photos[0]} alt={l.title} className="w-full h-full object-cover" />
                  ) : null}
                </div>
                <div className="p-2">
                  <div className="text-xs font-semibold truncate">{l.title}</div>
                  <div className="text-[10px] text-muted-foreground truncate">
                    {l.breed ?? l.species ?? ""} {l.city ? `· ${l.city}` : ""}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </Card>

      <Suspense fallback={<div className="h-[88px]" />}>
        <StoryRail />
      </Suspense>

      <section className="pb-10 mt-4">
        <PostFeed
          scope="all"
          emptyState={
            <EmptyState
              icon={Heart}
              title="Your feed will appear here"
              description="Follow breeders, shelters and pets you love."
              ctaLabel="Explore Discover"
              onCta={() => nav("/discover")}
            />
          }
        />
      </section>
    </div>
  );
};

export default BuyerHome;
