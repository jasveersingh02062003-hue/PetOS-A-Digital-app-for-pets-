import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Heart, ShieldCheck, MapPin, Plus, Loader2 } from "lucide-react";

type Filters = { species?: string; intent?: string; city?: string };

export const MatesGrid = () => {
  const nav = useNavigate();
  const [filters, setFilters] = useState<Filters>({});

  const { data: listings, isLoading } = useQuery({
    queryKey: ["mating-listings", filters],
    queryFn: async () => {
      let q = supabase
        .from("mating_listings")
        .select("id, intent, fee_inr, city, description, pets:pet_id(id, name, breed, species, gender, avatar_url, vaccination_verified)")
        .eq("active", true)
        .order("created_at", { ascending: false })
        .limit(50);
      if (filters.intent) q = q.eq("intent", filters.intent as any);
      if (filters.city) q = q.eq("city", filters.city);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []).filter((l: any) => !filters.species || l.pets?.species === filters.species);
    },
  });

  const cities = useMemo(() => Array.from(new Set((listings ?? []).map((l: any) => l.city).filter(Boolean))), [listings]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar -mx-1 px-1 pb-1">
        <FilterChip label="All" active={!filters.species && !filters.intent} onClick={() => setFilters({})} />
        <FilterChip label="Dogs" active={filters.species === "dog"} onClick={() => setFilters({ ...filters, species: filters.species === "dog" ? undefined : "dog" })} />
        <FilterChip label="Cats" active={filters.species === "cat"} onClick={() => setFilters({ ...filters, species: filters.species === "cat" ? undefined : "cat" })} />
        <FilterChip label="Stud" active={filters.intent === "stud"} onClick={() => setFilters({ ...filters, intent: filters.intent === "stud" ? undefined : "stud" })} />
        <FilterChip label="Dam" active={filters.intent === "dam"} onClick={() => setFilters({ ...filters, intent: filters.intent === "dam" ? undefined : "dam" })} />
      </div>

      <Button onClick={() => nav("/mates/new")} variant="outline" className="w-full rounded-2xl h-12 gap-2 border-dashed border-hairline">
        <Plus className="h-4 w-4" /> List your pet for mating
      </Button>

      {isLoading ? (
        <div className="py-8 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : !listings?.length ? (
        <Card className="rounded-2xl border-hairline bg-card shadow-none p-7 text-center">
          <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <Heart className="h-5 w-5 text-primary" strokeWidth={1.6} />
          </div>
          <div className="font-display text-lg leading-tight">No mating listings yet</div>
          <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed max-w-[280px] mx-auto">
            Pets only show here once their owners list them with vaccination proof. Be among the first in your city.
          </p>
          <Button onClick={() => nav("/mates/new")} className="mt-5 rounded-xl h-11">
            List your pet
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {listings.map((l: any) => (
            <button
              key={l.id}
              onClick={() => nav(`/mates/listing/${l.id}`)}
              className="text-left rounded-2xl border border-hairline bg-card overflow-hidden hover:shadow-sm transition-shadow"
            >
              <div className="aspect-square bg-muted relative">
                {l.pets?.avatar_url ? (
                  <img src={l.pets.avatar_url} alt={l.pets.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full grid place-items-center font-display text-3xl text-primary">{l.pets?.name?.[0] ?? "?"}</div>
                )}
                {l.pets?.vaccination_verified && (
                  <Badge className="absolute top-2 left-2 bg-primary text-primary-foreground border-0 gap-1 text-[10px]">
                    <ShieldCheck className="h-3 w-3" /> Verified
                  </Badge>
                )}
                <Badge className="absolute top-2 right-2 bg-background/90 text-foreground border-0 capitalize text-[10px]">{l.intent}</Badge>
              </div>
              <div className="p-3">
                <div className="font-medium truncate">{l.pets?.name}</div>
                <div className="text-xs text-muted-foreground truncate">{l.pets?.breed ?? l.pets?.species}</div>
                <div className="flex items-center justify-between mt-2 text-xs">
                  {l.city ? <span className="flex items-center gap-1 text-muted-foreground"><MapPin className="h-3 w-3" />{l.city}</span> : <span />}
                  {l.fee_inr ? <span className="font-medium text-primary">₹{l.fee_inr.toLocaleString("en-IN")}</span> : <span className="text-muted-foreground">Free</span>}
                </div>
              </div>
            </button>
          ))}
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
