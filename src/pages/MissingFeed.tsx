import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, MapPin, Clock, Eye, Navigation, Sparkles } from "lucide-react";

const formatTimeAgo = (iso: string) => {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (diff < 1) return "just now";
  if (diff < 60) return `${diff} min ago`;
  if (diff < 60 * 24) return `${Math.floor(diff / 60)}h ago`;
  return `${Math.floor(diff / (60 * 24))}d ago`;
};

const MissingFeed = () => {
  const nav = useNavigate();
  const qc = useQueryClient();
  const { data: profile } = useProfile();
  const userCity = profile?.city ?? null;
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [radiusKm, setRadiusKm] = useState<number | "all">("all");

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {},
      { timeout: 6000, maximumAge: 60_000 },
    );
  }, []);

  const { data: items, isLoading } = useQuery({
    queryKey: ["missing-pets", "feed", userCity],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("missing_pets")
        .select("id, pet_id, photo_url, last_seen_city, last_seen_at, last_seen_lat, last_seen_lng, reward_inr, note, created_at, boosted_until")
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      const ids = (data ?? []).map((m: any) => m.pet_id);
      let petsMap: Record<string, any> = {};
      if (ids.length) {
        const { data: pets } = await supabase.rpc("get_pets_public");
        petsMap = Object.fromEntries((pets ?? []).filter((p: any) => ids.includes(p.id)).map((p: any) => [p.id, p]));
      }
      const missingIds = (data ?? []).map((m: any) => m.id);
      const countMap: Record<string, number> = {};
      if (missingIds.length) {
        const { data: sights } = await supabase
          .from("missing_pet_sightings")
          .select("missing_pet_id")
          .in("missing_pet_id", missingIds);
        (sights ?? []).forEach((s: any) => {
          countMap[s.missing_pet_id] = (countMap[s.missing_pet_id] ?? 0) + 1;
        });
      }
      return (data ?? []).map((m: any) => ({ ...m, pet: petsMap[m.pet_id], sighting_count: countMap[m.id] ?? 0 }));
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel("missing-feed-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "missing_pets" }, () => {
        qc.invalidateQueries({ queryKey: ["missing-pets", "feed"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const enriched = useMemo(() => {
    return (items ?? []).map((m: any) => ({
      ...m,
      is_boosted: !!m.boosted_until && new Date(m.boosted_until) > new Date(),
      distance_km: coords && m.last_seen_lat && m.last_seen_lng
        ? haversine(coords.lat, coords.lng, Number(m.last_seen_lat), Number(m.last_seen_lng))
        : null,
    }));
  }, [items, coords]);

  const filtered = useMemo(() => {
    const base =
      radiusKm === "all"
        ? enriched
        : enriched.filter((m) => m.distance_km !== null && m.distance_km <= radiusKm);
    // Boosted always pinned to the top of their section
    return [...base].sort((a, b) => Number(b.is_boosted) - Number(a.is_boosted));
  }, [enriched, radiusKm]);

  const local = filtered.filter((m: any) => userCity && m.last_seen_city?.toLowerCase() === userCity.toLowerCase());
  const others = filtered.filter((m: any) => !userCity || m.last_seen_city?.toLowerCase() !== userCity.toLowerCase());

  return (
    <div className="min-h-screen bg-background pad-bottom-safe">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-hairline">
        <div className="container-app h-14 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => nav(-1)}><ArrowLeft className="h-5 w-5" /></Button>
          <h1 className="font-display text-xl">Missing pets</h1>
        </div>
      </header>

      <main className="container-app py-6 space-y-6">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar -mx-1 px-1 pb-1">
          <span className="text-[11px] uppercase tracking-wide text-muted-foreground shrink-0 mr-1">
            <Navigation className="h-3 w-3 inline mr-1" />Within
          </span>
          {([5, 10, 25, 50, "all"] as const).map((r) => (
            <button
              key={String(r)}
              onClick={() => setRadiusKm(r)}
              disabled={r !== "all" && !coords}
              className={`shrink-0 h-7 px-3 rounded-full text-[11px] font-medium border transition disabled:opacity-40 ${
                radiusKm === r ? "bg-foreground text-background border-foreground" : "bg-card text-muted-foreground border-hairline"
              }`}
            >
              {r === "all" ? "Anywhere" : `${r} km`}
            </button>
          ))}
          {!coords && (
            <span className="text-[10px] text-muted-foreground shrink-0">Enable location to filter</span>
          )}
        </div>

        {isLoading && (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <Card key={i} className="rounded-2xl h-24 animate-pulse bg-muted/40 border-hairline" />
            ))}
          </div>
        )}

        {!isLoading && filtered.length === 0 && (
          <Card className="rounded-2xl border-hairline p-8 text-center text-sm text-muted-foreground shadow-none">
            {items?.length ? "No reports within this radius. Try a wider range." : "No active reports right now. That's a good thing."}
          </Card>
        )}

        {local.length > 0 && (
          <Section title={`Near ${userCity}`} count={local.length}>
            {local.map((m) => <MissingCard key={m.id} m={m} />)}
          </Section>
        )}

        {others.length > 0 && (
          <Section title="Other cities" count={others.length}>
            {others.map((m) => <MissingCard key={m.id} m={m} />)}
          </Section>
        )}
      </main>
    </div>
  );
};

const Section = ({ title, count, children }: { title: string; count: number; children: React.ReactNode }) => (
  <div>
    <div className="flex items-center justify-between mb-3 px-1">
      <h2 className="font-display text-lg">{title}</h2>
      <span className="text-xs text-muted-foreground">{count}</span>
    </div>
    <div className="space-y-3">{children}</div>
  </div>
);

const MissingCard = ({ m }: { m: any }) => {
  const nav = useNavigate();
  return (
    <Card
      onClick={() => nav(`/missing/${m.id}`)}
      className="rounded-2xl border-hairline shadow-none overflow-hidden cursor-pointer hover:bg-muted/30 transition-colors"
    >
      <div className="flex gap-3 p-3">
        <div className="h-20 w-20 rounded-xl bg-muted overflow-hidden shrink-0">
          {m.photo_url ? <img src={m.photo_url} alt={m.pet?.name ?? "missing pet"} className="h-full w-full object-cover" /> : null}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-2">
            <div className="font-display text-base truncate">{m.pet?.name ?? "Pet"}</div>
            {m.reward_inr ? (
              <span className="text-[11px] font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full shrink-0">
                ₹{m.reward_inr} reward
              </span>
            ) : null}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5 truncate">
            {m.pet?.species}{m.pet?.breed ? ` · ${m.pet.breed}` : ""}
          </div>
          <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{m.last_seen_city ?? "—"}</span>
            <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{formatTimeAgo(m.created_at)}</span>
            {m.distance_km !== null && m.distance_km !== undefined && (
              <span className="inline-flex items-center gap-1 text-foreground font-medium">
                <Navigation className="h-3 w-3" />{m.distance_km < 1 ? "<1" : Math.round(m.distance_km)} km
              </span>
            )}
            {m.sighting_count > 0 && (
              <span className="inline-flex items-center gap-1 text-coral font-semibold">
                <Eye className="h-3 w-3" />{m.sighting_count} sighting{m.sighting_count > 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
};

function haversine(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export default MissingFeed;
