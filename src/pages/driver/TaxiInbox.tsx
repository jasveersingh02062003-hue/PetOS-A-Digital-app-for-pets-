import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserLocation } from "@/hooks/useUserLocation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, MapPin, Car } from "lucide-react";
import { PlaceBidSheet } from "@/components/taxi/PlaceBidSheet";

const TaxiInbox = () => {
  const nav = useNavigate();
  const { user } = useAuth();
  const { coords } = useUserLocation();
  const qc = useQueryClient();
  const [bidFor, setBidFor] = useState<{ bookingId: string; distanceKm?: number | null } | null>(null);

  const { data: provider } = useQuery({
    queryKey: ["my-taxi-provider", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("service_providers")
        .select("id, name, lat, lng, active, category")
        .eq("owner_id", user!.id)
        .eq("category", "pet_taxi")
        .eq("active", true)
        .maybeSingle();
      return data;
    },
  });

  const { data: trips } = useQuery({
    queryKey: ["driver-inbox", user?.id],
    enabled: !!provider,
    queryFn: async () => {
      const { data } = await supabase
        .from("transport_bookings")
        .select("id, pickup_address, dropoff_address, pickup_lat, pickup_lng, scheduled_at, fare_inr, customer_id")
        .eq("status", "requested")
        .order("created_at", { ascending: false })
        .limit(40);
      return data ?? [];
    },
  });

  useEffect(() => {
    if (!provider) return;
    const ch = supabase.channel("driver-inbox-feed")
      .on("postgres_changes" as any,
        { event: "*", schema: "public", table: "transport_bookings" },
        () => qc.invalidateQueries({ queryKey: ["driver-inbox", user?.id] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [provider, qc, user?.id]);

  const here = coords ?? (provider?.lat && provider?.lng ? { lat: Number(provider.lat), lng: Number(provider.lng) } : null);

  const ranked = useMemo(() => {
    if (!trips) return [];
    const withDist = trips.map((t: any) => {
      let d: number | null = null;
      if (here && t.pickup_lat && t.pickup_lng) {
        const toRad = (x: number) => (x * Math.PI) / 180;
        const dLat = toRad(Number(t.pickup_lat) - here.lat);
        const dLng = toRad(Number(t.pickup_lng) - here.lng);
        const a = Math.sin(dLat/2)**2 + Math.cos(toRad(here.lat))*Math.cos(toRad(Number(t.pickup_lat)))*Math.sin(dLng/2)**2;
        d = 6371 * 2 * Math.asin(Math.sqrt(a));
      }
      return { ...t, distance_km: d };
    });
    return withDist.sort((a, b) => (a.distance_km ?? 9999) - (b.distance_km ?? 9999));
  }, [trips, here]);

  if (!user) return <div className="container-app py-10 text-sm">Sign in to see trips.</div>;
  if (!provider) {
    return (
      <div className="container-app py-10 space-y-3 text-center">
        <Car className="h-10 w-10 mx-auto text-muted-foreground" />
        <div className="font-display text-lg">You're not a pet-taxi driver yet</div>
        <p className="text-sm text-muted-foreground">Set up a pet_taxi service to start receiving trip requests.</p>
        <Button asChild><Link to="/onboarding/provider">Become a driver</Link></Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-hairline">
        <div className="container-app h-14 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => nav(-1)}><ArrowLeft className="h-5 w-5" /></Button>
          <h1 className="font-display text-xl">Taxi requests</h1>
        </div>
      </header>
      <main className="container-app py-4 space-y-3">
        {ranked.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-10">No requested trips right now.</div>
        ) : ranked.map((t: any) => (
          <Card key={t.id} className="rounded-2xl border-hairline p-3 space-y-2">
            <div className="text-xs text-muted-foreground">{new Date(t.scheduled_at).toLocaleString()}</div>
            <div className="text-sm flex gap-2"><MapPin className="h-4 w-4 text-primary shrink-0 mt-0.5" />{t.pickup_address}</div>
            <div className="text-sm flex gap-2"><MapPin className="h-4 w-4 text-destructive shrink-0 mt-0.5" />{t.dropoff_address}</div>
            {t.distance_km != null && (
              <div className="text-xs text-muted-foreground">{t.distance_km.toFixed(1)} km from you</div>
            )}
            <Button size="sm" className="rounded-full" onClick={() => setBidFor({ bookingId: t.id, distanceKm: t.distance_km })}>
              Place bid
            </Button>
          </Card>
        ))}
      </main>
      {bidFor && provider && (
        <PlaceBidSheet
          open={!!bidFor}
          onOpenChange={(v) => !v && setBidFor(null)}
          bookingId={bidFor.bookingId}
          driverProviderId={provider.id}
          distanceKm={bidFor.distanceKm ?? null}
        />
      )}
    </div>
  );
};

export default TaxiInbox;