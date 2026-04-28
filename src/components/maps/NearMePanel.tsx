import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { LeafletMap, type MapMarker } from "@/components/maps/LeafletMap";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, MapPin, Navigation, Stethoscope, Briefcase, AlertTriangle, Users } from "lucide-react";
import { toast } from "sonner";

type Kind = "vets" | "providers" | "missing" | "meetups";

const kindMeta: Record<Kind, { label: string; icon: any; rpc: string; color: MapMarker["color"]; route: (r: any) => string }> = {
  vets:      { label: "Vets",     icon: Stethoscope, rpc: "nearby_vets",     color: "primary", route: (r) => `/u/${r.user_id}` },
  providers: { label: "Services", icon: Briefcase,   rpc: "nearby_providers",color: "success", route: (r) => `/services/${r.id}` },
  missing:   { label: "Missing",  icon: AlertTriangle,rpc: "nearby_missing", color: "danger",  route: (r) => `/missing/${r.id}` },
  meetups:   { label: "Meetups",  icon: Users,       rpc: "nearby_meetups",  color: "muted",   route: (r) => `/meetups/${r.id}` },
};

export const NearMePanel = () => {
  const nav = useNavigate();
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [radius, setRadius] = useState(25);
  const [kind, setKind] = useState<Kind>("vets");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const locate = () => {
    if (!navigator.geolocation) return toast.error("Geolocation not supported");
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLoading(false);
      },
      (err) => { toast.error(err.message); setLoading(false); },
      { timeout: 10_000 }
    );
  };

  useEffect(() => { locate(); /* eslint-disable-next-line */ }, []);

  useEffect(() => {
    if (!coords) return;
    setLoading(true);
    (async () => {
      const meta = kindMeta[kind];
      const { data, error } = await supabase.rpc(meta.rpc as any, {
        _lat: coords.lat,
        _lng: coords.lng,
        _radius_km: radius,
      });
      if (error) toast.error(error.message);
      setResults((data as any[]) ?? []);
      setLoading(false);
    })();
  }, [coords, radius, kind]);

  const markers: MapMarker[] = results
    .filter((r) => r.lat && r.lng)
    .map((r) => ({
      id: r.id ?? r.user_id,
      lat: Number(r.lat),
      lng: Number(r.lng),
      color: kindMeta[kind].color,
      title: r.display_name ?? r.name ?? r.title ?? "Pet",
      description: `${Number(r.distance_km).toFixed(1)} km away`,
    }));

  if (coords) {
    markers.unshift({ id: "me", lat: coords.lat, lng: coords.lng, color: "primary", title: "You" });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {(Object.keys(kindMeta) as Kind[]).map((k) => {
          const Icon = kindMeta[k].icon;
          const active = kind === k;
          return (
            <Button
              key={k}
              size="sm"
              variant={active ? "default" : "outline"}
              className="rounded-full h-8"
              onClick={() => setKind(k)}
            >
              <Icon className="h-3.5 w-3.5 mr-1.5" />
              {kindMeta[k].label}
            </Button>
          );
        })}
      </div>

      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" className="rounded-full h-8" onClick={locate}>
          <Navigation className="h-3.5 w-3.5 mr-1.5" /> Locate me
        </Button>
        <select
          className="h-8 text-xs rounded-full border border-hairline bg-background px-3"
          value={radius}
          onChange={(e) => setRadius(Number(e.target.value))}
        >
          {[5, 10, 25, 50, 100].map((r) => <option key={r} value={r}>{r} km</option>)}
        </select>
      </div>

      {!coords ? (
        <Card className="p-6 text-center text-sm text-muted-foreground rounded-2xl border-hairline">
          <MapPin className="h-6 w-6 mx-auto mb-2" />
          Enable location to discover {kindMeta[kind].label.toLowerCase()} near you.
        </Card>
      ) : (
        <>
          <LeafletMap
            center={[coords.lat, coords.lng]}
            zoom={radius <= 10 ? 13 : radius <= 25 ? 12 : 11}
            height="280px"
            markers={markers}
            onMarkerClick={(id) => {
              const r = results.find((x) => (x.id ?? x.user_id) === id);
              if (r) nav(kindMeta[kind].route(r));
            }}
          />
          {loading ? (
            <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : results.length === 0 ? (
            <Card className="p-6 text-center text-sm text-muted-foreground rounded-2xl border-hairline">
              No {kindMeta[kind].label.toLowerCase()} found within {radius} km.
            </Card>
          ) : (
            <div className="space-y-2">
              {results.map((r) => (
                <Card
                  key={r.id ?? r.user_id}
                  onClick={() => nav(kindMeta[kind].route(r))}
                  className="rounded-2xl border-hairline shadow-none p-3 flex items-center gap-3 cursor-pointer hover:bg-muted/50"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">
                      {r.display_name ?? r.name ?? r.title ?? "Pet"}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {r.city ?? "—"}{r.clinic_name ? ` · ${r.clinic_name}` : ""}
                    </div>
                  </div>
                  <div className="text-xs font-medium text-primary">
                    {Number(r.distance_km).toFixed(1)} km
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};
