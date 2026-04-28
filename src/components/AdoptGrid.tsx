import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PawPrint, ShieldCheck, MapPin, Plus, BadgeCheck } from "lucide-react";
import { SmartImage } from "@/components/SmartImage";
import { GridSkeleton } from "@/components/skeletons/FeedSkeleton";

type Filters = { species?: string; type?: "adoption" | "rehoming" | "breeder_sale"; city?: string };

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
  const [filters, setFilters] = useState<Filters>({});

  const { data: listings, isLoading } = useQuery({
    queryKey: ["pet-listings", filters],
    queryFn: async () => {
      let q = supabase
        .from("pet_listings")
        .select("id, listing_type, fee_inr, city, title, description, photos, age_weeks, species, breed, gender")
        .eq("active", true)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(50);
      if (filters.type) q = q.eq("listing_type", filters.type);
      if (filters.city) q = q.eq("city", filters.city);
      if (filters.species) q = q.eq("species", filters.species);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
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

      <Button onClick={() => nav("/mates/adopt/new")} variant="outline" className="w-full rounded-2xl h-12 gap-2 border-dashed border-hairline">
        <Plus className="h-4 w-4" /> List a pet for adoption or rehoming
      </Button>

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
                </div>
                <div className="p-3">
                  <div className="font-medium truncate">{l.title}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {[l.breed ?? l.species, l.age_weeks ? `${Math.floor(l.age_weeks / 4)} mo` : null].filter(Boolean).join(" · ")}
                  </div>
                  <div className="flex items-center justify-between mt-2 text-xs">
                    {l.city ? <span className="flex items-center gap-1 text-muted-foreground"><MapPin className="h-3 w-3" />{l.city}</span> : <span />}
                    {l.listing_type === "adoption" || !l.fee_inr ? (
                      <span className="text-leaf font-semibold">Free</span>
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