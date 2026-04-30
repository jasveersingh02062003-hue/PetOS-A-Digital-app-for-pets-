import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUpcomingMeetups, type Meetup } from "@/hooks/useMeetups";
import { useProfile } from "@/hooks/useProfile";
import { useUserLocation } from "@/hooks/useUserLocation";
import { MeetupCard } from "@/components/social/MeetupCard";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/EmptyState";
import { MeetupListSkeleton } from "@/components/skeletons/FeedSkeleton";
import { NearbyToggle } from "@/components/marketplace/NearbyToggle";
import { ArrowLeft, CalendarPlus, Users, Navigation } from "lucide-react";

const RADII: { v: number | "all"; label: string }[] = [
  { v: 5, label: "5 km" }, { v: 10, label: "10 km" }, { v: 25, label: "25 km" },
  { v: 50, label: "50 km" }, { v: "all", label: "Anywhere" },
];

const Meetups = () => {
  const nav = useNavigate();
  const qc = useQueryClient();
  const { data: profile } = useProfile();
  const { coords } = useUserLocation();
  const [nearestOn, setNearestOn] = useState(true);
  const [radiusKm, setRadiusKm] = useState<number | "all">(25);

  const useNearby = !!coords && nearestOn && radiusKm !== "all";

  // Nearest-first via RPC (returns rows + distance_km)
  const { data: nearbyRows, isLoading: nearbyLoading } = useQuery({
    queryKey: ["meetups-nearby", coords?.lat, coords?.lng, radiusKm],
    enabled: useNearby,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("nearby_meetups" as any, {
        _lat: coords!.lat, _lng: coords!.lng,
        _radius_km: typeof radiusKm === "number" ? radiusKm : 50,
      });
      if (error) throw error;
      // Hydrate full meetup rows so the existing MeetupCard works
      const ids = ((data ?? []) as any[]).map((r: any) => r.id);
      if (!ids.length) return [];
      const { data: full } = await supabase
        .from("meetups").select("*").in("id", ids).eq("status", "upcoming");
      const distMap: Record<string, number> = {};
      (data as any[]).forEach((r) => { distMap[r.id] = Number(r.distance_km); });
      return ((full ?? []) as Meetup[])
        .map((m) => ({ meetup: m, distanceKm: distMap[m.id] ?? null }))
        .sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
    },
  });

  // Fallback (no location, or "Anywhere") — city-aware list
  const { data: cityMeetups } = useUpcomingMeetups(profile?.city);
  const { data: allMeetups } = useUpcomingMeetups();
  const fallback = useMemo(() => {
    const base = cityMeetups && cityMeetups.length > 0 ? cityMeetups : allMeetups;
    return (base ?? []).map((m) => ({ meetup: m, distanceKm: null as number | null }));
  }, [cityMeetups, allMeetups]);

  const list = useNearby ? (nearbyRows ?? []) : fallback;
  const loading = useNearby ? nearbyLoading : (cityMeetups === undefined && allMeetups === undefined);

  // Realtime: any new/updated meetup invalidates both branches
  useEffect(() => {
    const ch = supabase
      .channel("meetups-rt")
      .on("postgres_changes" as any, { event: "*", schema: "public", table: "meetups" }, () => {
        qc.invalidateQueries({ queryKey: ["meetups-nearby"] });
        qc.invalidateQueries({ queryKey: ["meetups", "upcoming"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  return (
    <div className="container-app pad-top-safe pb-16">
      <header className="pt-4 pb-3 flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => nav(-1)}><ArrowLeft className="h-5 w-5" /></Button>
        <h1 className="font-display text-2xl flex-1">Meetups</h1>
        <Button size="sm" className="rounded-full" onClick={() => nav("/meetups/new")}>
          <CalendarPlus className="h-4 w-4 mr-1.5" /> Host
        </Button>
      </header>

      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <NearbyToggle active={nearestOn} onChange={setNearestOn} hasLocation={!!coords} />
        {nearestOn && coords && (
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground shrink-0 mr-1">
              <Navigation className="h-3 w-3 inline mr-0.5" />Within
            </span>
            {RADII.map((r) => (
              <button
                key={String(r.v)}
                onClick={() => setRadiusKm(r.v)}
                className={`shrink-0 h-7 px-2.5 rounded-full text-[11px] font-medium border transition ${
                  radiusKm === r.v
                    ? "bg-foreground text-background border-foreground"
                    : "bg-card text-muted-foreground border-hairline"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {!useNearby && profile?.city && (
        <div className="text-xs text-muted-foreground mb-3">
          {(cityMeetups?.length ?? 0) > 0 ? `Upcoming in ${profile.city}` : `No meetups in ${profile.city} yet — showing all`}
        </div>
      )}

      <div className="space-y-3">
        {loading ? (
          <MeetupListSkeleton count={4} />
        ) : (
        <>
        {list.map(({ meetup, distanceKm }) => (
          <MeetupCard key={meetup.id} meetup={meetup} distanceKm={distanceKm} />
        ))}
        {list.length === 0 && (
          <EmptyState
            icon={Users}
            title={useNearby ? "Nothing nearby" : "No upcoming meetups"}
            description={useNearby ? "No meetups within this radius. Try expanding it." : "Be the first to host a playdate in your area."}
            ctaLabel="Host a meetup"
            onCta={() => nav("/meetups/new")}
            onExpandRadius={useNearby && radiusKm !== "all" ? () => setRadiusKm(radiusKm === 5 ? 10 : radiusKm === 10 ? 25 : radiusKm === 25 ? 50 : "all") : undefined}
          />
        )}
        </>
        )}
      </div>
    </div>
  );
};

export default Meetups;
