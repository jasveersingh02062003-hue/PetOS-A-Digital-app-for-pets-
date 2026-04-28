import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, MapPin, ShieldCheck, Navigation } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/ui/toggle";
import { useUserLocation } from "@/hooks/useUserLocation";
import { useSeo } from "@/hooks/useSeo";
import { getCategoryMeta, TONE_BG, type ServiceCategory } from "@/lib/serviceCategories";
import { SubjectRating } from "@/components/SubjectRating";

type SortKey = "distance" | "rating" | "price";

const ServiceCategoryPage = () => {
  const { category } = useParams<{ category: string }>();
  const nav = useNavigate();
  const meta = getCategoryMeta(category ?? "");
  const { coords, loading: locating, requestBrowser } = useUserLocation();
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [sort, setSort] = useState<SortKey>(coords ? "distance" : "rating");

  useSeo({
    title: meta ? `${meta.label} near you on PetOS` : "Pet services on PetOS",
    description: meta?.description,
  });

  const { data: providers, isLoading } = useQuery({
    queryKey: ["category-providers", category, coords?.lat, coords?.lng, verifiedOnly],
    enabled: !!meta,
    queryFn: async () => {
      if (coords) {
        const { data } = await supabase.rpc("nearby_providers" as any, {
          _lat: coords.lat,
          _lng: coords.lng,
          _radius_km: 50,
          _category: meta!.key,
        });
        let arr = ((data as any[]) ?? []).filter((p) => !verifiedOnly || p.verified);
        return arr;
      }
      let q = supabase
        .from("service_providers")
        .select("id, name, category, city, cover_url, verified, hourly_rate_inr, lat, lng")
        .eq("active", true)
        .eq("category", meta!.key as ServiceCategory)
        .limit(60);
      if (verifiedOnly) q = q.eq("verified", true);
      const { data } = await q;
      return data ?? [];
    },
  });

  const sorted = useMemo(() => {
    const arr = [...(providers ?? [])];
    if (sort === "distance") arr.sort((a: any, b: any) => Number(a.distance_km ?? 9999) - Number(b.distance_km ?? 9999));
    else if (sort === "price") arr.sort((a: any, b: any) => (a.hourly_rate_inr ?? 1e9) - (b.hourly_rate_inr ?? 1e9));
    else arr.sort((a: any, b: any) => Number(b.verified) - Number(a.verified));
    return arr;
  }, [providers, sort]);

  if (!meta) {
    return <div className="container-app pt-10 text-center text-muted-foreground">Unknown category.</div>;
  }
  const Icon = meta.icon;

  return (
    <div className="container-app pad-top-safe pb-24 max-w-2xl">
      <button onClick={() => nav(-1)} className="flex items-center gap-1 text-sm text-muted-foreground mt-4 mb-3">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <div className="flex items-center gap-3 mb-1">
        <div className={`h-11 w-11 rounded-2xl grid place-items-center ${TONE_BG[meta.tone]}`}>
          <Icon className="h-5 w-5" strokeWidth={2} />
        </div>
        <div>
          <h1 className="font-display text-2xl leading-tight">{meta.label}</h1>
          <p className="text-xs text-muted-foreground">{meta.description}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 mt-4 mb-4">
        <Toggle pressed={verifiedOnly} onPressedChange={setVerifiedOnly} className="rounded-full h-8 px-3 text-xs gap-1 data-[state=on]:bg-leaf/15 data-[state=on]:text-leaf">
          <ShieldCheck className="h-3 w-3" /> Verified only
        </Toggle>
        <div className="ml-auto flex items-center gap-1">
          {(["distance", "rating", "price"] as SortKey[]).map((k) => (
            <button
              key={k}
              onClick={() => setSort(k)}
              disabled={k === "distance" && !coords}
              className={`text-[11px] px-2.5 h-7 rounded-full border ${sort === k ? "bg-primary text-primary-foreground border-primary" : "border-hairline bg-card"} ${k === "distance" && !coords ? "opacity-50" : ""}`}
            >
              {k === "distance" ? "Nearest" : k === "rating" ? "Top rated" : "Cheapest"}
            </button>
          ))}
        </div>
      </div>

      {!coords && !locating && (
        <Card className="rounded-2xl border-hairline p-3 mb-4 flex items-center justify-between gap-2">
          <div className="text-xs text-muted-foreground">Allow location to sort by distance.</div>
          <Button size="sm" variant="outline" onClick={requestBrowser} className="rounded-full h-7 text-xs gap-1">
            <Navigation className="h-3 w-3" /> Use my location
          </Button>
        </Card>
      )}

      {isLoading && <div className="text-center text-sm text-muted-foreground py-6">Loading…</div>}
      {!isLoading && sorted.length === 0 && (
        <div className="text-center text-sm text-muted-foreground py-8">
          No {meta.short.toLowerCase()}s found yet.
        </div>
      )}

      <div className="space-y-2">
        {sorted.map((p: any) => (
          <Card key={p.id} onClick={() => nav(`/services/${p.id}`)} className="rounded-2xl border-hairline p-3 flex items-center gap-3 cursor-pointer hover:bg-muted/40">
            <div className="h-14 w-14 rounded-xl bg-muted overflow-hidden grid place-items-center shrink-0">
              {p.cover_url ? <img src={p.cover_url} alt={p.name} className="w-full h-full object-cover" /> : <Icon className="h-5 w-5 text-muted-foreground" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-medium truncate">{p.name}</span>
                {p.verified && <ShieldCheck className="h-3.5 w-3.5 text-leaf shrink-0" />}
              </div>
              <div className="text-[11px] text-muted-foreground flex items-center gap-2 mt-0.5">
                {p.city && <span className="flex items-center gap-0.5"><MapPin className="h-2.5 w-2.5" />{p.city}</span>}
                {p.distance_km != null && <span>{Number(p.distance_km).toFixed(1)} km</span>}
              </div>
              <div className="mt-0.5"><SubjectRating type="provider" id={p.id} size="sm" /></div>
            </div>
            {p.hourly_rate_inr ? (
              <div className="text-sm font-medium shrink-0">₹{p.hourly_rate_inr}<span className="text-[10px] text-muted-foreground">/hr</span></div>
            ) : null}
          </Card>
        ))}
      </div>
    </div>
  );
};

export default ServiceCategoryPage;