import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Stethoscope, MapPin, Star, Phone, Navigation } from "lucide-react";
import { useUserLocation } from "@/hooks/useUserLocation";
import { NearbyToggle } from "@/components/marketplace/NearbyToggle";
import { DistanceChip } from "@/components/marketplace/DistanceChip";
import { EmptyState } from "@/components/empty/EmptyState";

const SPECIALTIES = [
  { key: "all", label: "All" },
  { key: "general", label: "General" },
  { key: "dermatology", label: "Skin" },
  { key: "surgery", label: "Surgery" },
  { key: "dental", label: "Dental" },
  { key: "behavior", label: "Behaviour" },
  { key: "exotic", label: "Exotic" },
];

export default function Vets() {
  const nav = useNavigate();
  const [specialty, setSpecialty] = useState<string>("all");
  const [open247, setOpen247] = useState(false);
  const [nearest, setNearest] = useState(true);
  const { coords } = useUserLocation();
  const hasLocation = !!coords;

  const { data: vets, isLoading } = useQuery({
    queryKey: ["discover-vets", specialty, open247, nearest, coords?.lat, coords?.lng],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("discover_vets" as any, {
        _lat: nearest && coords ? coords.lat : null,
        _lng: nearest && coords ? coords.lng : null,
        _specialty: specialty === "all" ? null : specialty,
        _open_24_7: open247,
        _radius_km: 50,
        _limit: 50,
      });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  return (
    <div className="container-app pad-top-safe pb-24">
      <header className="pt-6 pb-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => nav(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="font-display text-2xl">Vets near you</h1>
          <p className="text-xs text-muted-foreground">Sorted by distance · book chat, video or in-clinic</p>
        </div>
      </header>

      <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 no-scrollbar items-center">
        <NearbyToggle active={nearest} onChange={setNearest} hasLocation={hasLocation} />
        <button
          onClick={() => setOpen247((v) => !v)}
          aria-pressed={open247}
          className={`shrink-0 h-8 px-3 rounded-full border text-xs font-medium transition ${
            open247 ? "bg-primary text-primary-foreground border-primary" : "bg-card border-hairline text-muted-foreground"
          }`}
        >
          24/7
        </button>
        {SPECIALTIES.map((s) => (
          <button
            key={s.key}
            onClick={() => setSpecialty(s.key)}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-sm whitespace-nowrap transition-colors ${
              specialty === s.key
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card border-hairline text-foreground hover:bg-muted"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="space-y-3 mt-3">
        {isLoading && <p className="text-sm text-muted-foreground">Loading vets…</p>}
        {!isLoading && (vets?.length ?? 0) === 0 && (
          <EmptyState
            icon={Stethoscope}
            title="No vets match your filters"
            description="Try widening the radius, removing the 24/7 filter, or picking a different specialty."
          />
        )}
        {vets?.map((v) => (
          <Card key={v.user_id} className="rounded-2xl border-hairline p-4">
            <div className="flex items-start gap-3">
              <div className="h-14 w-14 rounded-2xl bg-primary-soft overflow-hidden flex items-center justify-center shrink-0">
                {v.photo_url ? (
                  <img src={v.photo_url} alt={v.display_name} className="h-full w-full object-cover" loading="lazy" />
                ) : (
                  <Stethoscope className="h-5 w-5 text-primary" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-display text-base leading-tight truncate">{v.display_name}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {v.clinic_name || "Independent"} {v.city ? `· ${v.city}` : ""}
                </div>
                <div className="mt-1 flex items-center gap-2 flex-wrap">
                  {v.rating_count > 0 && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
                      {Number(v.rating_avg).toFixed(1)} ({v.rating_count})
                    </span>
                  )}
                  <DistanceChip distanceKm={v.distance_km} />
                </div>
                {v.specialisations?.length ? (
                  <div className="mt-1 flex gap-1 flex-wrap">
                    {v.specialisations.slice(0, 3).map((s: string) => (
                      <span key={s} className="text-[10px] rounded-full bg-muted px-1.5 py-0.5 capitalize">
                        {s}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
              {v.price_video_inr && (
                <div className="text-right">
                  <div className="text-sm font-medium">₹{v.price_video_inr}</div>
                  <div className="text-[10px] text-muted-foreground">video</div>
                </div>
              )}
            </div>
            <div className="mt-3 pt-3 border-t border-hairline flex items-center gap-2">
              <Button asChild size="sm" className="rounded-full flex-1">
                <Link to={`/book-vet?vet=${v.user_id}`}>Book</Link>
              </Button>
              {v.lat != null && v.lng != null && (
                <Button asChild size="sm" variant="outline" className="rounded-full">
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${v.lat},${v.lng}`}
                    target="_blank" rel="noreferrer noopener"
                    aria-label="Get directions"
                  >
                    <Navigation className="h-3.5 w-3.5" />
                  </a>
                </Button>
              )}
              {v.phone && (
                <Button asChild size="sm" variant="outline" className="rounded-full">
                  <a href={`tel:${v.phone}`} aria-label="Call clinic">
                    <Phone className="h-3.5 w-3.5" />
                  </a>
                </Button>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
