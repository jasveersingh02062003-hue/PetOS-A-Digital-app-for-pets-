import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { LeafletMap } from "@/components/maps/LeafletMap";
import { pawIcon } from "@/components/maps/PawMarker";
import { Card } from "@/components/ui/card";
import { MapPin, Loader2 } from "lucide-react";

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
  const polyline = tracks.map((t) => [Number(t.lat), Number(t.lng)] as [number, number]);
  const center: [number, number] = last
    ? [Number(last.lat), Number(last.lng)]
    : [20.5937, 78.9629];

  // Distance traveled
  const distanceKm = polyline.reduce((acc, pt, i) => {
    if (i === 0) return 0;
    const [la1, lo1] = polyline[i - 1];
    const [la2, lo2] = pt;
    const R = 6371;
    const dLat = ((la2 - la1) * Math.PI) / 180;
    const dLon = ((lo2 - lo1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((la1 * Math.PI) / 180) *
        Math.cos((la2 * Math.PI) / 180) *
        Math.sin(dLon / 2) ** 2;
    return acc + 2 * R * Math.asin(Math.sqrt(a));
  }, 0);

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
              <span>Updated {new Date(last.recorded_at).toLocaleTimeString()}</span>
              <span className="font-medium text-foreground">{distanceKm.toFixed(2)} km</span>
            </div>
          )}
        </Card>
        <p className="text-[11px] text-muted-foreground text-center pb-6">
          Live walk shared via Petos · auto-refreshes every 5s
        </p>
      </div>
    </div>
  );
};

export default WalkLive;
