import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Heart, ShieldCheck, MapPin, Plus, Send } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { SmartImage } from "@/components/SmartImage";
import { GridSkeleton } from "@/components/skeletons/FeedSkeleton";

type Filters = { species?: string; intent?: string; city?: string };

export const MatesGrid = () => {
  const nav = useNavigate();
  const { user } = useAuth();
  const [filters, setFilters] = useState<Filters>({});

  const { data: listings, isLoading } = useQuery({
    queryKey: ["mating-listings", filters],
    queryFn: async () => {
      let q = supabase
        .from("mating_listings")
        .select("id, intent, fee_inr, city, description, owner_id, pet_id, paid_until, boosted_until, featured, pets:pet_id(id, name, breed, species, gender, avatar_url, vaccination_verified)")
        .eq("active", true)
        .or(`paid_until.is.null,paid_until.gt.${new Date().toISOString()}`)
        .order("featured", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(50);
      if (filters.intent) q = q.eq("intent", filters.intent as any);
      if (filters.city) q = q.eq("city", filters.city);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []).filter((l: any) => !filters.species || l.pets?.species === filters.species);
    },
  });

  const sendRequest = async (e: React.MouseEvent, l: any) => {
    e.stopPropagation();
    if (!user) {
      toast.error("Sign in to send a request");
      return;
    }
    if (l.owner_id === user.id) {
      toast.info("This is your own listing");
      return;
    }
    // Find requester's first pet to attach
    const { data: myPets } = await supabase
      .from("pets")
      .select("id")
      .eq("owner_id", user.id)
      .limit(1);
    if (!myPets?.length) {
      toast.error("Add a pet first");
      nav("/onboarding");
      return;
    }
    const { error } = await supabase.from("mating_requests").insert({
      from_owner_id: user.id,
      from_pet_id: myPets[0].id,
      to_owner_id: l.owner_id,
      to_pet_id: l.pet_id,
      message: "Hi, I'm interested in your listing.",
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Request sent");
  };

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
        <GridSkeleton count={6} cols={2} />
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
            <div
              key={l.id}
              className="text-left rounded-2xl border border-hairline bg-card overflow-hidden hover:shadow-sm transition-shadow flex flex-col"
            >
              <button onClick={() => nav(`/mates/listing/${l.id}`)} className="aspect-square bg-muted relative block w-full">
                {l.pets?.avatar_url ? (
                  <SmartImage src={l.pets.avatar_url} alt={l.pets.name} aspect="1/1" className="w-full h-full" />
                ) : (
                  <div className="w-full h-full grid place-items-center font-display text-3xl text-primary">{l.pets?.name?.[0] ?? "?"}</div>
                )}
                {l.pets?.vaccination_verified && (
                  <Badge className="absolute top-2 left-2 bg-primary text-primary-foreground border-0 gap-1 text-[10px]">
                    <ShieldCheck className="h-3 w-3" /> Verified
                  </Badge>
                )}
                <Badge className="absolute top-2 right-2 bg-background/90 text-foreground border-0 capitalize text-[10px]">{l.intent}</Badge>
              </button>
              <button onClick={() => nav(`/mates/listing/${l.id}`)} className="p-3 text-left">
                <div className="font-medium truncate">{l.pets?.name}</div>
                <div className="text-xs text-muted-foreground truncate">{l.pets?.breed ?? l.pets?.species}</div>
                <div className="flex items-center justify-between mt-2 text-xs">
                  {l.city ? <span className="flex items-center gap-1 text-muted-foreground"><MapPin className="h-3 w-3" />{l.city}</span> : <span />}
                  {l.fee_inr ? <span className="font-medium text-primary">₹{l.fee_inr.toLocaleString("en-IN")}</span> : <span className="text-muted-foreground">Free</span>}
                </div>
              </button>
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => sendRequest(e, l)}
                className="mx-3 mb-3 mt-0 rounded-xl h-8 gap-1.5 text-xs border-primary/30 text-primary hover:bg-primary/5"
              >
                <Send className="h-3 w-3" /> Send request
              </Button>
            </div>
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
