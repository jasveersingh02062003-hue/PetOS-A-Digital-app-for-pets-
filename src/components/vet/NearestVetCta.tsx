import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Stethoscope, MapPin, Phone, Navigation, Video } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useUserLocation } from "@/hooks/useUserLocation";

type NearbyVet = {
  user_id: string;
  display_name: string | null;
  clinic_name: string | null;
  photo_url: string | null;
  city: string | null;
  lat: number;
  lng: number;
  price_video_inr: number | null;
  rating_avg: number | null;
  distance_km: number;
};

/**
 * Shown after the AI triage classifies severity as moderate/severe.
 * Pulls the 3 closest active vets via `nearby_vets` and offers
 * one-tap Call / Directions / Book video.
 */
export function NearestVetCta({ radiusKm = 25 }: { radiusKm?: number }) {
  const { coords } = useUserLocation();

  const { data: vets, isLoading } = useQuery({
    queryKey: ["nearest-vets", coords?.lat, coords?.lng, radiusKm],
    enabled: !!coords,
    queryFn: async (): Promise<NearbyVet[]> => {
      const { data, error } = await supabase.rpc("nearby_vets" as any, {
        _lat: coords!.lat, _lng: coords!.lng, _radius_km: radiusKm,
      });
      if (error) throw error;
      return ((data ?? []) as any[])
        .sort((a, b) => Number(a.distance_km) - Number(b.distance_km))
        .slice(0, 3);
    },
  });

  if (!coords) {
    return (
      <Card className="rounded-2xl border-hairline p-4 text-sm text-muted-foreground">
        Enable location to see the nearest open vets.
      </Card>
    );
  }

  if (isLoading) {
    return <Card className="rounded-2xl border-hairline p-4 text-sm text-muted-foreground">Finding nearest vets…</Card>;
  }

  if (!vets?.length) {
    return (
      <Card className="rounded-2xl border-hairline p-4 text-sm text-muted-foreground">
        No vets within {radiusKm} km. Try widening or message Petos support.
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl border-hairline p-3 space-y-2">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold flex items-center gap-1.5 px-1">
        <Stethoscope className="h-3.5 w-3.5 text-primary" /> Nearest vets right now
      </div>
      {vets.map((v) => {
        const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${v.lat},${v.lng}`;
        return (
          <div key={v.user_id} className="rounded-xl border border-hairline p-3 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">
                {v.display_name || "Veterinarian"}
              </div>
              <div className="text-[11px] text-muted-foreground truncate">
                {v.clinic_name || v.city || "Clinic"} · {Number(v.distance_km).toFixed(1)} km
              </div>
            </div>
            <a
              href={directionsUrl}
              target="_blank"
              rel="noreferrer"
              className="h-8 w-8 grid place-items-center rounded-full bg-muted hover:bg-muted/80"
              aria-label="Directions"
            >
              <Navigation className="h-4 w-4" />
            </a>
            <Button asChild size="sm" className="h-8 rounded-full px-3 text-xs gap-1">
              <Link to={`/u/${v.user_id}`}>
                <Video className="h-3.5 w-3.5" /> Book
              </Link>
            </Button>
          </div>
        );
      })}
      <div className="flex items-center justify-center pt-1">
        <Link to="/discover" className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
          <MapPin className="h-3 w-3" /> See all on map
        </Link>
      </div>
    </Card>
  );
}