import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, MapPin, Play, Square, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { LeafletMap } from "@/components/maps/LeafletMap";

type Track = { id: string; lat: number; lng: number; recorded_at: string };

const WalkSession = () => {
  const { id } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();
  const watchRef = useRef<number | null>(null);
  const [tracking, setTracking] = useState(false);

  const { data: booking } = useQuery({
    queryKey: ["walk-booking", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_bookings")
        .select("id, customer_id, provider_id, status, scheduled_at")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const { data: prov } = await supabase
        .from("service_providers")
        .select("id, name, owner_id")
        .eq("id", (data as any).provider_id)
        .maybeSingle();
      return { ...data, provider: prov };
    },
  });

  const { data: tracks } = useQuery({
    queryKey: ["walk-tracks", id],
    enabled: !!id,
    queryFn: async () => {
      const { data } = await supabase
        .from("walk_tracks" as any)
        .select("id, lat, lng, recorded_at")
        .eq("booking_id", id!)
        .order("recorded_at");
      return ((data ?? []) as unknown as Track[]);
    },
    refetchInterval: tracking ? false : 5000,
  });

  // Realtime subscription for track points
  useEffect(() => {
    if (!id) return;
    const ch = supabase
      .channel(`walk-${id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "walk_tracks", filter: `booking_id=eq.${id}` },
        () => qc.invalidateQueries({ queryKey: ["walk-tracks", id] })
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id, qc]);

  const isProvider = !!user && !!booking?.provider && (booking.provider as any).owner_id === user.id;
  const isCustomer = !!user && !!booking && booking.customer_id === user.id;

  const startTracking = () => {
    if (!("geolocation" in navigator)) return toast.error("GPS not supported");
    setTracking(true);
    watchRef.current = navigator.geolocation.watchPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        await supabase.from("walk_tracks" as any).insert({
          booking_id: id,
          lat: latitude,
          lng: longitude,
        });
      },
      (err) => {
        toast.error(err.message);
        setTracking(false);
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );
    toast.success("Walk started — sharing location");
  };

  const stopTracking = () => {
    if (watchRef.current != null) navigator.geolocation.clearWatch(watchRef.current);
    watchRef.current = null;
    setTracking(false);
    toast.message("Walk ended");
  };

  useEffect(() => () => {
    if (watchRef.current != null) navigator.geolocation.clearWatch(watchRef.current);
  }, []);

  const last = tracks?.[tracks.length - 1];
  const polyline = (tracks ?? []).map((t) => [t.lat, t.lng] as [number, number]);
  // Distance covered (haversine sum, km)
  const distanceKm = polyline.reduce((acc, pt, i) => {
    if (i === 0) return 0;
    const [la1, lo1] = polyline[i - 1];
    const [la2, lo2] = pt;
    const R = 6371;
    const dLat = ((la2 - la1) * Math.PI) / 180;
    const dLon = ((lo2 - lo1) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos((la1 * Math.PI) / 180) * Math.cos((la2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
    return acc + 2 * R * Math.asin(Math.sqrt(a));
  }, 0);

  if (!booking) {
    return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-hairline px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => nav(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="font-medium truncate">Walk · {(booking.provider as any)?.name ?? "Provider"}</div>
          <div className="text-xs text-muted-foreground">
            {tracks?.length ?? 0} location pings
          </div>
        </div>
      </header>

      <div className="container-app pt-4 space-y-3">
        <Card className="rounded-2xl border-hairline overflow-hidden p-0">
          {last ? (
            <LeafletMap
              center={[last.lat, last.lng]}
              zoom={16}
              height="320px"
              followLast={tracking}
              markers={[{ id: "last", lat: last.lat, lng: last.lng, color: "primary", title: "Current location" }]}
              polyline={polyline}
            />
          ) : (
            <div className="aspect-square bg-muted h-full flex flex-col items-center justify-center text-muted-foreground gap-2">
              <MapPin className="h-8 w-8" />
              <div className="text-xs">No location yet</div>
            </div>
          )}
          {last && (
            <div className="p-3 text-xs text-muted-foreground flex items-center justify-between">
              <span>Last update {new Date(last.recorded_at).toLocaleTimeString()}</span>
              <span className="font-medium text-foreground">{distanceKm.toFixed(2)} km</span>
            </div>
          )}
        </Card>

        {isProvider && (
          <div className="grid grid-cols-2 gap-2">
            {!tracking ? (
              <Button onClick={startTracking} className="rounded-full col-span-2">
                <Play className="h-4 w-4 mr-2" /> Start walk
              </Button>
            ) : (
              <>
                <Button variant="outline" disabled className="rounded-full">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" /> Sharing
                </Button>
                <Button variant="destructive" onClick={stopTracking} className="rounded-full">
                  <Square className="h-4 w-4 mr-2" /> End walk
                </Button>
              </>
            )}
          </div>
        )}

        {isCustomer && (
          <div className="text-xs text-muted-foreground text-center">
            Live location updates from your walker. Refreshes automatically.
          </div>
        )}

        {!isProvider && !isCustomer && (
          <div className="text-xs text-muted-foreground text-center">You can't view this walk.</div>
        )}
      </div>
    </div>
  );
};

export default WalkSession;
