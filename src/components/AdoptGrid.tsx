import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PawPrint, MapPin, Plus, BadgeCheck, Sparkles, AlertTriangle, Heart } from "lucide-react";
import { SmartImage } from "@/components/SmartImage";
import { GridSkeleton } from "@/components/skeletons/FeedSkeleton";
import { SellerBadge } from "@/components/SellerBadge";
import { Input } from "@/components/ui/input";
import { useProfile } from "@/hooks/useProfile";
import { useVerifiedOrgs } from "@/hooks/useVerifiedOrgs";
import { HealthTestRail } from "@/components/marketplace/HealthTestChip";
import { WishlistButton } from "@/components/marketplace/WishlistButton";

type SellerType = "pet_parent" | "breeder" | "kennel" | "shelter" | "sanctuary" | "rescuer";
type Filters = {
  species?: string;
  type?: "adoption" | "rehoming" | "breeder_sale";
  city?: string;
  seller?: SellerType;
  bredOnly?: boolean;
  maxPrice?: number;
};

const TYPE_LABEL: Record<string, string> = {
  adoption: "Adoption",
  rehoming: "Rehoming",
  breeder_sale: "Breeder",
};
const TYPE_TONE: Record<string, string> = {
  adoption: "bg-leaf/15 text-leaf border-leaf/30",
  rehoming: "bg-coral/15 text-coral border-coral/30",
  breeder_sale: "bg-sky/15 text-sky border-sky/30",
};

export const AdoptGrid = () => {
  const nav = useNavigate();
  const { data: profile } = useProfile();
  const isBuyer = (profile as any)?.account_type === "buyer";
  const [filters, setFilters] = useState<Filters>({});
  const { data: verifiedOrgs } = useVerifiedOrgs();

  // Seed filters from buyer's preferences on first load
  useEffect(() => {
    if (!profile) return;
    const lf = (profile as any).looking_for as
      | { species?: string[] | null; city?: string | null; max_price_inr?: number | null }
      | null;
    if (!lf) return;
    setFilters((cur) => ({
      species: cur.species ?? (lf.species && lf.species.length === 1 ? lf.species[0] : undefined),
      city: cur.city ?? (lf.city || undefined),
      maxPrice: cur.maxPrice ?? (lf.max_price_inr ?? undefined),
      type: cur.type,
      seller: cur.seller,
      bredOnly: cur.bredOnly,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  const { data: listings, isLoading } = useQuery({
    queryKey: ["pet-listings", filters],
    queryFn: async () => {
      let q = supabase
        .from("pet_listings")
        .select("id, owner_id, listing_type, fee_inr, city, title, photos, age_weeks, species, breed, gender, seller_type, bred_on_petos, litter_id, health_tests, co_listed_with_org_id, monthly_upkeep_inr")
        .eq("active", true)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(50);
      if (filters.type) q = q.eq("listing_type", filters.type);
      if (filters.city) q = q.ilike("city", `%${filters.city}%`);
      if (filters.species) q = q.eq("species", filters.species);
      if (filters.seller) q = q.eq("seller_type", filters.seller);
      if (filters.bredOnly) q = q.eq("bred_on_petos", true);
      if (typeof filters.maxPrice === "number") q = q.lte("fee_inr", filters.maxPrice);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  // Repeat-seller IDs for warning chip
  const { data: repeatSellerIds } = useQuery({
    queryKey: ["repeat-sellers"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await supabase.from("repeat_sellers" as any).select("owner_id");
      return new Set<string>((data ?? []).map((r: any) => r.owner_id));
    },
  });

  // Co-list shelter names for the "Co-listed with X ✓" subline.
  const colistIds = Array.from(new Set((listings ?? []).map((l: any) => l.co_listed_with_org_id).filter(Boolean) as string[]));
  const { data: colistShelters } = useQuery({
    queryKey: ["colist-shelters", colistIds.sort().join(",")],
    enabled: colistIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from("org_profiles").select("user_id, org_name").in("user_id", colistIds);
      const map = new Map<string, string>();
      (data ?? []).forEach((r: any) => map.set(r.user_id, r.org_name));
      return map;
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar -mx-1 px-1 pb-1">
        <FilterChip label="All" active={!filters.species && !filters.type} onClick={() => setFilters({})} />
        <FilterChip label="Adoption" active={filters.type === "adoption"} onClick={() => setFilters({ ...filters, type: filters.type === "adoption" ? undefined : "adoption" })} />
        <FilterChip label="Rehoming" active={filters.type === "rehoming"} onClick={() => setFilters({ ...filters, type: filters.type === "rehoming" ? undefined : "rehoming" })} />
        <FilterChip label="Breeders" active={filters.type === "breeder_sale"} onClick={() => setFilters({ ...filters, type: filters.type === "breeder_sale" ? undefined : "breeder_sale" })} />
        <FilterChip label="Dogs" active={filters.species === "dog"} onClick={() => setFilters({ ...filters, species: filters.species === "dog" ? undefined : "dog" })} />
        <FilterChip label="Cats" active={filters.species === "cat"} onClick={() => setFilters({ ...filters, species: filters.species === "cat" ? undefined : "cat" })} />
      </div>
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar -mx-1 px-1 pb-1">
        <span className="text-[11px] uppercase tracking-wider text-muted-foreground shrink-0 px-1">Seller</span>
        <FilterChip label="Shelters" active={filters.seller === "shelter"} onClick={() => setFilters({ ...filters, seller: filters.seller === "shelter" ? undefined : "shelter" })} />
        <FilterChip label="Sanctuaries" active={filters.seller === "sanctuary"} onClick={() => setFilters({ ...filters, seller: filters.seller === "sanctuary" ? undefined : "sanctuary" })} />
        <FilterChip label="Verified breeders" active={filters.seller === "breeder"} onClick={() => setFilters({ ...filters, seller: filters.seller === "breeder" ? undefined : "breeder" })} />
        <FilterChip label="Kennels" active={filters.seller === "kennel"} onClick={() => setFilters({ ...filters, seller: filters.seller === "kennel" ? undefined : "kennel" })} />
        <FilterChip label="Pet parents" active={filters.seller === "pet_parent"} onClick={() => setFilters({ ...filters, seller: filters.seller === "pet_parent" ? undefined : "pet_parent" })} />
        <FilterChip label="Rescuers" active={filters.seller === "rescuer"} onClick={() => setFilters({ ...filters, seller: filters.seller === "rescuer" ? undefined : "rescuer" })} />
      </div>

      <div className="flex items-center gap-2 -mx-1 px-1">
        <button
          onClick={() => setFilters({ ...filters, bredOnly: !filters.bredOnly })}
          className={`shrink-0 px-3 py-1.5 rounded-full text-xs border transition-colors flex items-center gap-1 ${
            filters.bredOnly ? "bg-coral text-coral-foreground border-coral" : "bg-card border-hairline text-foreground"
          }`}
        >
          <Sparkles className="h-3 w-3" /> Bred on PetOS only
        </button>
        <Input
          placeholder="City…"
          value={filters.city ?? ""}
          onChange={(e) => setFilters({ ...filters, city: e.target.value || undefined })}
          className="h-8 rounded-full text-xs flex-1 max-w-[160px]"
        />
        <Input
          type="number"
          inputMode="numeric"
          placeholder="Max ₹"
          value={filters.maxPrice ?? ""}
          onChange={(e) =>
            setFilters({ ...filters, maxPrice: e.target.value ? parseInt(e.target.value, 10) : undefined })
          }
          className="h-8 rounded-full text-xs w-[110px]"
        />
      </div>

      {!isBuyer && (
        <Button onClick={() => nav("/mates/adopt/new")} variant="outline" className="w-full rounded-2xl h-12 gap-2 border-dashed border-hairline">
          <Plus className="h-4 w-4" /> List a pet for adoption or rehoming
        </Button>
      )}

      <Card className="rounded-2xl border-hairline bg-muted/30 shadow-none p-3 text-[11px] text-muted-foreground leading-relaxed">
        <strong className="text-foreground">Safety first:</strong> never pay before meeting the pet in person. Verify vaccination and breeder credentials. Pets under 8 weeks cannot be listed.
      </Card>

      {isLoading ? (
        <GridSkeleton count={6} cols={2} />
      ) : !listings?.length ? (
        <Card className="rounded-2xl border-hairline bg-card shadow-none p-7 text-center">
          <div className="mx-auto h-12 w-12 rounded-full bg-leaf/10 flex items-center justify-center mb-4">
            <PawPrint className="h-5 w-5 text-leaf" strokeWidth={1.6} />
          </div>
          <div className="font-display text-lg leading-tight">No listings yet</div>
          <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed max-w-[280px] mx-auto">
            Be the first to help a pet find a loving home in your city.
          </p>
          <Button onClick={() => nav("/mates/adopt/new")} className="mt-5 rounded-xl h-11">
            Create a listing
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {listings.map((l: any) => {
            const photo = Array.isArray(l.photos) && l.photos.length ? l.photos[0] : null;
            const isFreeShelter = l.seller_type === "shelter" || l.seller_type === "sanctuary" || l.seller_type === "rescuer" || l.listing_type === "adoption";
            const isRepeatSeller = repeatSellerIds?.has((l as any).owner_id) && l.seller_type === "pet_parent";
            return (
              <button
                key={l.id}
                onClick={() => nav(`/mates/adopt/${l.id}`)}
                className="text-left rounded-2xl border border-hairline bg-card overflow-hidden hover:shadow-sm transition-shadow"
              >
                <div className="aspect-square bg-muted relative">
                  {photo ? (
                    <SmartImage src={photo} alt={l.title} aspect="1/1" className="w-full h-full" />
                  ) : (
                    <div className="w-full h-full grid place-items-center font-display text-3xl text-muted-foreground">
                      <PawPrint className="h-8 w-8" />
                    </div>
                  )}
                  <Badge className={`absolute top-2 left-2 border ${TYPE_TONE[l.listing_type]} text-[10px] gap-1`}>
                    {l.listing_type === "breeder_sale" && <BadgeCheck className="h-3 w-3" />}
                    {TYPE_LABEL[l.listing_type]}
                  </Badge>
                  {l.bred_on_petos && (
                    <Badge className="absolute top-2 right-2 bg-card/90 text-foreground border border-coral/30 text-[10px] gap-1">
                      <Sparkles className="h-3 w-3 text-coral" /> Bred on PetOS
                    </Badge>
                  )}
                  <div className="absolute bottom-2 right-2">
                    <WishlistButton listingId={l.id} />
                  </div>
                </div>
                <div className="p-3">
                  <div className="font-medium truncate">{l.title}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {[l.breed ?? l.species, l.age_weeks ? `${Math.floor(l.age_weeks / 4)} mo` : null].filter(Boolean).join(" · ")}
                  </div>
                  <div className="mt-1.5">
                    <SellerBadge
                      type={l.seller_type ?? "pet_parent"}
                      verified={verifiedOrgs?.has(l.owner_id) ?? false}
                    />
                  </div>
                  {isRepeatSeller && (
                    <div className="mt-1.5 inline-flex items-center gap-1 px-2 h-5 rounded-full bg-amber-500/15 text-amber-700 text-[10px] font-semibold border border-amber-500/30">
                      <AlertTriangle className="h-2.5 w-2.5" /> Repeat seller
                    </div>
                  )}
                  {l.co_listed_with_org_id && colistShelters?.get(l.co_listed_with_org_id) && (
                    <div className="mt-1.5 inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                      Co-listed with <span className="font-medium text-foreground truncate max-w-[110px]">{colistShelters.get(l.co_listed_with_org_id)}</span>
                      <BadgeCheck className="h-2.5 w-2.5 text-leaf shrink-0" />
                    </div>
                  )}
                  {Array.isArray(l.health_tests) && l.health_tests.length > 0 && (
                    <div className="mt-1.5">
                      <HealthTestRail entries={l.health_tests as any} max={2} />
                    </div>
                  )}
                  <div className="flex items-center justify-between mt-2 text-xs">
                    {l.city ? <span className="flex items-center gap-1 text-muted-foreground"><MapPin className="h-3 w-3" />{l.city}</span> : <span />}
                    {isFreeShelter || !l.fee_inr ? (
                      <span className="text-leaf font-semibold inline-flex items-center gap-1">
                        {(l.seller_type === "shelter" || l.seller_type === "sanctuary") && <Heart className="h-3 w-3" fill="currentColor" />}
                        Free · adopt
                      </span>
                    ) : (
                      <span className="font-medium text-primary">₹{l.fee_inr.toLocaleString("en-IN")}</span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

const FilterChip = ({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) => (
  <button
    onClick={onClick}
    className={`shrink-0 px-3 py-1.5 rounded-full text-xs border transition-colors ${
      active ? "bg-primary text-primary-foreground border-primary" : "bg-card border-hairline text-foreground"
    }`}
  >
    {label}
  </button>
);