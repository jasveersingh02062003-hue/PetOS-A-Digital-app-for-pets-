import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, MapPin, Star, ShieldCheck, Navigation, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SearchBar } from "@/components/SearchBar";
import { useUserLocation } from "@/hooks/useUserLocation";
import { useSeo } from "@/hooks/useSeo";
import { SERVICE_CATEGORIES, TONE_BG, type ServiceCategoryMeta } from "@/lib/serviceCategories";
import { SubjectRating } from "@/components/SubjectRating";

const DiscoverServices = () => {
  const nav = useNavigate();
  const { coords, loading: locating, error: locError, requestBrowser } = useUserLocation();

  useSeo({
    title: "Pet services near you — grooming, vets, training & more",
    description: "Find verified pet groomers, vet clinics, trainers, daycare, caretakers and pet taxis near you on PetOS.",
  });

  const { data: nearby, isLoading: nearbyLoading } = useQuery({
    queryKey: ["nearby-services-all", coords?.lat, coords?.lng],
    enabled: !!coords,
    queryFn: async () => {
      const { data } = await supabase.rpc("nearby_providers" as any, {
        _lat: coords!.lat,
        _lng: coords!.lng,
        _radius_km: 25,
      });
      return (data as any[]) ?? [];
    },
  });

  const { data: topRated } = useQuery({
    queryKey: ["top-rated-providers"],
    queryFn: async () => {
      const { data } = await supabase
        .from("service_providers")
        .select("id, name, category, city, cover_url, verified, hourly_rate_inr")
        .eq("active", true)
        .eq("verified", true)
        .limit(8);
      return data ?? [];
    },
  });

  return (
    <div className="container-app pad-top-safe pb-24 max-w-2xl">
      <button onClick={() => nav(-1)} className="flex items-center gap-1 text-sm text-muted-foreground mt-4 mb-3">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <h1 className="font-display text-[28px] leading-tight">Services near you</h1>
      <p className="text-sm text-muted-foreground mt-1 mb-4">
        Verified groomers, vets, trainers, sitters, daycare, caretakers & more.
      </p>

      <div className="mb-4"><SearchBar /></div>

      {/* CATEGORY GRID */}
      <h2 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2">Browse by category</h2>
      <div className="grid grid-cols-3 gap-2 mb-6">
        {SERVICE_CATEGORIES.map((c) => (
          <CategoryTile key={c.key} meta={c} onClick={() => nav(`/services/category/${c.key}`)} />
        ))}
      </div>

      {/* NEAR YOU */}
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Near you (25 km)</h2>
        {!coords && !locating && (
          <Button size="sm" variant="outline" onClick={requestBrowser} className="rounded-full h-7 text-xs gap-1">
            <Navigation className="h-3 w-3" /> Use my location
          </Button>
        )}
      </div>

      {locating && <div className="text-sm text-muted-foreground py-4 text-center">Finding your location…</div>}
      {!locating && !coords && (
        <Card className="rounded-2xl border-hairline p-4 mb-6 text-sm text-muted-foreground">
          {locError ?? "Allow location to see what's around you."}
        </Card>
      )}
      {coords && nearbyLoading && <div className="text-sm text-muted-foreground py-4 text-center">Loading nearby pros…</div>}
      {coords && !nearbyLoading && (nearby?.length ?? 0) === 0 && (
        <Card className="rounded-2xl border-hairline p-4 mb-6 text-sm text-muted-foreground">
          No providers within 25 km yet. Try widening — or be the first to list.
        </Card>
      )}
      {coords && !!nearby?.length && (
        <div className="space-y-2 mb-6">
          {nearby!.slice(0, 6).map((p: any) => (
            <ProviderRow key={p.id} provider={p} onClick={() => nav(`/services/${p.id}`)} />
          ))}
          {nearby!.length > 6 && (
            <button onClick={() => nav("/services")} className="text-sm text-primary font-semibold flex items-center gap-1">
              See all <ArrowRight className="h-3 w-3" />
            </button>
          )}
        </div>
      )}

      {/* TOP RATED */}
      {!!topRated?.length && (
        <>
          <h2 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2">Verified pros</h2>
          <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 pb-2">
            {topRated.map((p: any) => (
              <button key={p.id} onClick={() => nav(`/services/${p.id}`)} className="shrink-0 w-44 text-left rounded-2xl border border-hairline bg-card overflow-hidden">
                <div className="aspect-square bg-muted">
                  {p.cover_url && <img src={p.cover_url} alt={p.name} className="w-full h-full object-cover" loading="lazy" decoding="async" />}
                </div>
                <div className="p-2.5">
                  <div className="text-sm font-medium truncate">{p.name}</div>
                  <div className="text-[11px] text-muted-foreground capitalize">{String(p.category).replace("_", " ")} · {p.city || "—"}</div>
                  <div className="mt-1 flex items-center justify-between">
                    <SubjectRating type="provider" id={p.id} size="sm" />
                    {p.hourly_rate_inr ? <span className="text-[11px] font-semibold">₹{p.hourly_rate_inr}/hr</span> : null}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

const CategoryTile = ({ meta, onClick }: { meta: ServiceCategoryMeta; onClick: () => void }) => {
  const Icon = meta.icon;
  return (
    <button
      onClick={onClick}
      className="rounded-2xl border border-hairline bg-card p-3 flex flex-col items-start gap-2 active:scale-[0.97] transition-transform"
    >
      <div className={`h-9 w-9 rounded-xl grid place-items-center ${TONE_BG[meta.tone]}`}>
        <Icon className="h-4 w-4" strokeWidth={2} />
      </div>
      <div className="text-[13px] font-display leading-tight">{meta.label}</div>
    </button>
  );
};

const ProviderRow = ({ provider, onClick }: { provider: any; onClick: () => void }) => (
  <Card onClick={onClick} className="rounded-2xl border-hairline p-3 flex items-center gap-3 cursor-pointer hover:bg-muted/40">
    <div className="h-12 w-12 rounded-xl bg-muted overflow-hidden grid place-items-center shrink-0">
      {provider.cover_url && <img src={provider.cover_url} alt={provider.name} className="w-full h-full object-cover" loading="lazy" decoding="async" />}
    </div>
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-1.5">
        <span className="font-medium truncate">{provider.name}</span>
        {provider.verified && <ShieldCheck className="h-3.5 w-3.5 text-leaf shrink-0" />}
      </div>
      <div className="text-[11px] text-muted-foreground capitalize flex items-center gap-2">
        <span>{String(provider.category).replace("_", " ")}</span>
        {provider.city && <span className="flex items-center gap-0.5"><MapPin className="h-2.5 w-2.5" />{provider.city}</span>}
      </div>
      <div className="text-[11px] text-muted-foreground mt-0.5">
        {Number(provider.distance_km).toFixed(1)} km away
      </div>
    </div>
    {provider.hourly_rate_inr ? (
      <div className="text-sm font-medium shrink-0">₹{provider.hourly_rate_inr}<span className="text-[10px] text-muted-foreground">/hr</span></div>
    ) : null}
  </Card>
);

export default DiscoverServices;