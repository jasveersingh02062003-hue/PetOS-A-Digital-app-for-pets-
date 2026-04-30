import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, MapPin, Play, Square, Loader2, Share2, Timer, Gauge, Activity, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { LeafletMap } from "@/components/maps/LeafletMap";
import { WalkHealthFlagSheet } from "@/components/walker/WalkHealthFlagSheet";
import { pawIcon } from "@/components/maps/PawMarker";
import { totalDistanceKm, formatDuration, paceMinPerKm, formatPace, type LatLng } from "@/lib/walkStats";
import { StatusProgress } from "@/components/booking/StatusProgress";
import { WALK_FLOW, WALK_LABELS } from "@/lib/bookingFlows";

type Track = { id: string; lat: number; lng: number; recorded_at: string };
type Summary = {
  id: string;
  booking_id: string;
  started_at: string;
  ended_at: string;
  duration_minutes: number;
  distance_km: number;
  point_count: number;
  avg_pace_min_per_km: number | null;
};

const WalkSession = () => {
  const { id } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();
  const watchRef = useRef<number | null>(null);
  const [tracking, setTracking] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState<number>(Date.now());
  const [lastPingAt, setLastPingAt] = useState<number | null>(null);
  const [flagOpen, setFlagOpen] = useState(false);
  const stalenessWarnedRef = useRef(false);

  const { data: booking } = useQuery({
    queryKey: ["walk-booking", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_bookings")
        .select("id, customer_id, provider_id, status, scheduled_at, public_share_token")
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

  const shareLive = async () => {
    const token = (booking as any)?.public_share_token;
    if (!token) return toast.error("Share link not ready");
    const url = `${window.location.origin}/walk-live/${token}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "Live walk", url });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success("Live walk link copied");
      }
    } catch {
      // user cancelled
    }
  };

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

  const { data: summary } = useQuery({
    queryKey: ["walk-summary", id],
    enabled: !!id,
    queryFn: async () => {
      const { data } = await supabase
        .from("walk_summaries" as any)
        .select("*")
        .eq("booking_id", id!)
        .maybeSingle();
      return (data ?? null) as unknown as Summary | null;
    },
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

  // 1s ticker for live duration + staleness detection
  useEffect(() => {
    if (!tracking) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [tracking]);

  // Warn once if no GPS ping for >3 min while tracking
  useEffect(() => {
    if (!tracking || !lastPingAt) return;
    if (now - lastPingAt > 3 * 60 * 1000 && !stalenessWarnedRef.current) {
      stalenessWarnedRef.current = true;
      toast.warning("No GPS ping for 3 minutes — check phone signal.");
    }
  }, [now, lastPingAt, tracking]);

  const isProvider = !!user && !!booking?.provider && (booking.provider as any).owner_id === user.id;
  const isCustomer = !!user && !!booking && booking.customer_id === user.id;

  const startTracking = () => {
    if (!("geolocation" in navigator)) return toast.error("GPS not supported");
    setTracking(true);
    const start = Date.now();
    setStartedAt(start);
    setLastPingAt(start);
    stalenessWarnedRef.current = false;
    watchRef.current = navigator.geolocation.watchPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        setLastPingAt(Date.now());
        stalenessWarnedRef.current = false;
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

  const stopTracking = async () => {
    if (watchRef.current != null) navigator.geolocation.clearWatch(watchRef.current);
    watchRef.current = null;
    setTracking(false);

    // Persist a walk summary (best effort)
    try {
      const pts: LatLng[] = (tracks ?? []).map((t) => [Number(t.lat), Number(t.lng)]);
      const distKm = totalDistanceKm(pts);
      const startIso = startedAt
        ? new Date(startedAt).toISOString()
        : (tracks?.[0]?.recorded_at ?? new Date().toISOString());
      const endIso = new Date().toISOString();
      const durMs = new Date(endIso).getTime() - new Date(startIso).getTime();
      const durMin = Math.max(0, Math.round(durMs / 60000));
      const pace = paceMinPerKm(distKm, durMs);
      await supabase.from("walk_summaries" as any).upsert(
        {
          booking_id: id,
          started_at: startIso,
          ended_at: endIso,
          duration_minutes: durMin,
          distance_km: Number(distKm.toFixed(3)),
          point_count: tracks?.length ?? 0,
          avg_pace_min_per_km: pace ? Number(pace.toFixed(2)) : null,
        },
        { onConflict: "booking_id" }
      );
      qc.invalidateQueries({ queryKey: ["walk-summary", id] });
      toast.success(`Walk ended · ${distKm.toFixed(2)} km in ${durMin} min`);
    } catch (_) {
      toast.message("Walk ended");
    }
    setStartedAt(null);
  };

  useEffect(() => () => {
    if (watchRef.current != null) navigator.geolocation.clearWatch(watchRef.current);
  }, []);

  const last = tracks?.[tracks.length - 1];
  const polyline: LatLng[] = (tracks ?? []).map((t) => [Number(t.lat), Number(t.lng)]);
  const distanceKm = totalDistanceKm(polyline);
  const elapsedMs = tracking && startedAt ? now - startedAt : 0;
  const livePace = paceMinPerKm(distanceKm, elapsedMs);
  const stale = tracking && lastPingAt != null && now - lastPingAt > 60 * 1000;

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
        {(() => {
          const bs = (booking as any)?.status as string | undefined;
          if (!bs || bs === "cancelled" || bs === "declined") return null;
          // Derive walk-specific step from booking.status + tracking signals.
          const hasRecent = !!last && Date.now() - new Date(last.recorded_at).getTime() < 5 * 60 * 1000;
          let step: (typeof WALK_FLOW)[number];
          if (bs === "completed") step = "completed";
          else if (tracking || hasRecent) step = "in_progress";
          else if (bs === "confirmed" && (tracks?.length ?? 0) > 0) step = "on_the_way";
          else step = "confirmed";
          return (
            <Card className="rounded-2xl border-hairline p-3">
              <StatusProgress
                flow={WALK_FLOW}
                status={step}
                labels={WALK_LABELS}
                liveStatuses={["on_the_way", "in_progress"] as const}
              />
            </Card>
          );
        })()}

        <Card className="rounded-2xl border-hairline overflow-hidden p-0">
          {last ? (
            <LeafletMap
              center={[last.lat, last.lng]}
              zoom={16}
              height="320px"
              followLast={tracking}
              markers={[{ id: "last", lat: last.lat, lng: last.lng, icon: pawIcon("#3b82f6"), title: "Current location" }]}
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

        {tracking && (
          <Card className="rounded-2xl border-hairline p-3">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="flex flex-col items-center gap-1">
                <Timer className="h-4 w-4 text-muted-foreground" />
                <div className="font-display text-lg leading-none tabular-nums">{formatDuration(elapsedMs)}</div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Time</div>
              </div>
              <div className="flex flex-col items-center gap-1">
                <Activity className="h-4 w-4 text-muted-foreground" />
                <div className="font-display text-lg leading-none tabular-nums">{distanceKm.toFixed(2)}</div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">km</div>
              </div>
              <div className="flex flex-col items-center gap-1">
                <Gauge className="h-4 w-4 text-muted-foreground" />
                <div className="font-display text-lg leading-none tabular-nums">{formatPace(livePace).replace(" /km", "")}</div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">min/km</div>
              </div>
            </div>
            {stale && (
              <div className="mt-3 flex items-center gap-2 text-xs text-amber-700 dark:text-amber-300 bg-amber-500/10 rounded-lg px-3 py-2">
                <AlertTriangle className="h-3.5 w-3.5" />
                Waiting for new GPS ping…
              </div>
            )}
          </Card>
        )}

        {!tracking && summary && (
          <Card className="rounded-2xl border-hairline p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="font-display text-base">Last walk recap</div>
              <span className="text-[11px] text-muted-foreground">
                {new Date(summary.ended_at).toLocaleString()}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <div className="font-display text-lg tabular-nums">{Number(summary.distance_km).toFixed(2)}</div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">km</div>
              </div>
              <div>
                <div className="font-display text-lg tabular-nums">{summary.duration_minutes}</div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">min</div>
              </div>
              <div>
                <div className="font-display text-lg tabular-nums">{formatPace(summary.avg_pace_min_per_km).replace(" /km", "")}</div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">min/km</div>
              </div>
            </div>
          </Card>
        )}

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

        {(isProvider || isCustomer) && (booking as any)?.public_share_token && (
          <Button variant="outline" onClick={shareLive} className="rounded-full w-full">
            <Share2 className="h-4 w-4 mr-2" /> Share live walk link
          </Button>
        )}

        {isProvider && tracking && (
          <Button
            variant="outline"
            onClick={() => setFlagOpen(true)}
            className="rounded-full w-full border-amber-500/50 text-amber-700 dark:text-amber-300 hover:bg-amber-500/10"
          >
            <AlertTriangle className="h-4 w-4 mr-2" /> Flag health concern
          </Button>
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
      {isProvider && id && (
        <WalkHealthFlagSheet open={flagOpen} onOpenChange={setFlagOpen} bookingId={id} />
      )}
    </div>
  );
};

export default WalkSession;
