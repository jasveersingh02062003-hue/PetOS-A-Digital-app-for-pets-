import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { LeafletMap } from "@/components/maps/LeafletMap";
import { pawIcon } from "@/components/maps/PawMarker";
import { Card } from "@/components/ui/card";
import { MapPin, Loader2, Timer, Activity, Gauge } from "lucide-react";
import { totalDistanceKm, formatDuration, paceMinPerKm, formatPace, type LatLng } from "@/lib/walkStats";

type Track = { lat: number; lng: number; recorded_at: string };
type WalkData = {
  booking_id: string;
  status: string;
  provider_name: string | null;
  pet_name: string | null;
  scheduled_at: string;
  tracks: Track[];
};

const WalkLive = () => {
  const { token } = useParams();
  const [data, setData] = useState<WalkData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [now, setNow] = useState<number>(Date.now());

  const fetchWalk = async () => {
    if (!token) return;
    const { data: rows, error } = await supabase.rpc("get_public_walk", { _token: token });
    if (error || !rows || rows.length === 0) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    setData(rows[0] as WalkData);
    setLoading(false);
  };

  useEffect(() => {
    fetchWalk();
    const interval = setInterval(fetchWalk, 5000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center">
        <Loader2 className="animate-spin h-5 w-5 text-muted-foreground" />
      </div>
    );
  }

  if (notFound || !data) {
    return (
      <div className="min-h-screen grid place-items-center px-6 text-center">
        <div className="space-y-2">
          <MapPin className="h-10 w-10 mx-auto text-muted-foreground" />
          <h1 className="font-display text-2xl">Walk not found</h1>
          <p className="text-sm text-muted-foreground">This share link may have expired.</p>
        </div>
      </div>
    );
  }

  const tracks = data.tracks ?? [];
  const last = tracks[tracks.length - 1];
  const polyline: LatLng[] = tracks.map((t) => [Number(t.lat), Number(t.lng)]);
  const center: [number, number] = last
    ? [Number(last.lat), Number(last.lng)]
    : [20.5937, 78.9629];

  const distanceKm = totalDistanceKm(polyline);
  const firstAt = tracks[0]?.recorded_at ? new Date(tracks[0].recorded_at).getTime() : null;
  const lastAt = last?.recorded_at ? new Date(last.recorded_at).getTime() : null;
  const durMs = firstAt && lastAt ? Math.max(0, lastAt - firstAt) : 0;
  const pace = paceMinPerKm(distanceKm, durMs);
  const stalenessSec = lastAt ? Math.max(0, Math.floor((now - lastAt) / 1000)) : null;
  const isStale = stalenessSec != null && stalenessSec > 60;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-hairline px-4 py-3">
        <div className="container-app flex items-center justify-between">
          <div>
            <div className="font-display text-lg leading-tight">
              {data.pet_name ?? "Pet"} on a walk
            </div>
            <div className="text-xs text-muted-foreground">
              with {data.provider_name ?? "walker"} · {data.status}
            </div>
          </div>
          <div className="text-xs text-muted-foreground">live</div>
        </div>
      </header>

      <div className="container-app pt-4 space-y-3">
        <Card className="rounded-2xl border-hairline overflow-hidden p-0">
          {last ? (
            <LeafletMap
              center={center}
              zoom={16}
              height="60vh"
              followLast
              markers={[
                {
                  id: "last",
                  lat: Number(last.lat),
                  lng: Number(last.lng),
                  title: data.pet_name ?? "Walker",
                  description: "Live position",
                  icon: pawIcon("#3b82f6"),
                },
              ]}
              polyline={polyline}
            />
          ) : (
            <div className="h-[60vh] grid place-items-center text-muted-foreground text-sm gap-2">
              <MapPin className="h-8 w-8" />
              Waiting for first GPS ping…
            </div>
          )}
          {last && (
            <div className="p-3 text-xs text-muted-foreground flex items-center justify-between">
              <span className={isStale ? "text-amber-700 dark:text-amber-300" : ""}>
                Updated {stalenessSec != null ? (stalenessSec < 60 ? `${stalenessSec}s ago` : `${Math.floor(stalenessSec / 60)}m ago`) : "—"}
              </span>
              <span className="font-medium text-foreground">{distanceKm.toFixed(2)} km</span>
            </div>
          )}
        </Card>

        {tracks.length > 1 && (
          <Card className="rounded-2xl border-hairline p-3">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="flex flex-col items-center gap-1">
                <Timer className="h-4 w-4 text-muted-foreground" />
                <div className="font-display text-lg leading-none tabular-nums">{formatDuration(durMs)}</div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Time</div>
              </div>
              <div className="flex flex-col items-center gap-1">
                <Activity className="h-4 w-4 text-muted-foreground" />
                <div className="font-display text-lg leading-none tabular-nums">{distanceKm.toFixed(2)}</div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">km</div>
              </div>
              <div className="flex flex-col items-center gap-1">
                <Gauge className="h-4 w-4 text-muted-foreground" />
                <div className="font-display text-lg leading-none tabular-nums">{formatPace(pace).replace(" /km", "")}</div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">min/km</div>
              </div>
            </div>
          </Card>
        )}

        <p className="text-[11px] text-muted-foreground text-center pb-6">
          Live walk shared via Petos · auto-refreshes every 5s
        </p>
      </div>
    </div>
  );
};

export default WalkLive;
