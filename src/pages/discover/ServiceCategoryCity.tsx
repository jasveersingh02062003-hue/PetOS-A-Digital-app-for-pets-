import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSeo } from "@/hooks/useSeo";
import { jsonLd } from "@/lib/seo";
import { useGeoCity } from "@/hooks/useGeoCity";
import { ListingFilters, type ListingFilterValue } from "@/components/marketplace/ListingFilters";
import { GeoBanner } from "@/components/marketplace/GeoBanner";
import { DistanceChip } from "@/components/marketplace/DistanceChip";
import { useNearbyQuery } from "@/hooks/useNearbyQuery";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, BadgeCheck, MapPin, Stethoscope } from "lucide-react";
import { SmartImage } from "@/components/SmartImage";
import { EmptyState } from "@/components/empty/EmptyState";
import { SERVICE_CATEGORIES, getCategoryMeta } from "@/lib/serviceCategories";

const cap = (s?: string | null) => s ? s.charAt(0).toUpperCase() + s.slice(1) : "";
const titleFromCity = (slug?: string | null) => slug ? slug.split("-").map(cap).join(" ") : "";

const ServiceCategoryCity = () => {
  const { category, city } = useParams<{ category?: string; city?: string }>();
  const nav = useNavigate();
  const { city: geoCity, displayCity, setCity } = useGeoCity();

  const meta = category ? getCategoryMeta(category) : undefined;
  const cityDisplay = city ? titleFromCity(city) : displayCity;

  const [filters, setFilters] = useState<ListingFilterValue>({
    city: cityDisplay ?? undefined,
    sort: "nearest",
    verifiedOnly: false,
  });

  useEffect(() => {
    setFilters((f) => ({ ...f, city: cityDisplay ?? f.city }));
  }, [cityDisplay]);

  const { data: tableProviders = [], isLoading: tableLoading } = useQuery({
    queryKey: ["service-cat", category, filters],
    enabled: filters.sort !== "nearest",
    queryFn: async () => {
      let q = supabase.from("service_providers").select("*")
        .eq("active", true)
        .limit(60);
      if (category) q = q.eq("category", category as any);
      if (filters.city) q = q.ilike("city", `%${filters.city}%`);
      if (filters.verifiedOnly) q = q.eq("verified", true);
      if (filters.priceMin != null) q = q.gte("hourly_rate_inr", filters.priceMin);
      if (filters.priceMax != null) q = q.lte("hourly_rate_inr", filters.priceMax);
      // "Open now" — fetch the open-now provider id list and intersect
      let openIds: string[] | null = null;
      if (filters.openNow) {
        const { data: openRows } = await supabase
          .rpc("providers_open_now", { _category: category ?? null, _city: filters.city ?? null });
        openIds = (openRows ?? []).map((r: any) => r.provider_id);
        if (openIds.length === 0) return [];
        q = q.in("id", openIds);
      }
      if (filters.sort === "price_asc") q = q.order("hourly_rate_inr", { ascending: true, nullsFirst: true });
      else if (filters.sort === "price_desc") q = q.order("hourly_rate_inr", { ascending: false });
      else if (filters.sort === "soonest_available")
        q = q.order("next_available_at", { ascending: true, nullsFirst: false });
      else if (filters.sort === "rating")
        q = q.order("verified", { ascending: false }).order("created_at", { ascending: false });
      else q = q.order("verified", { ascending: false }).order("created_at", { ascending: false });
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: nearbyProviders = [], isLoading: nearbyLoading } = useNearbyQuery<any>(
    "discover_providers",
    { _category: category ?? null, _city: filters.city ?? null, _radius_km: 50, _limit: 60 },
    { enabled: filters.sort === "nearest" },
  );

  const providers = filters.sort === "nearest" ? (nearbyProviders as any[]) : (tableProviders as any[]);
  const isLoading = filters.sort === "nearest" ? nearbyLoading : tableLoading;

  const title = `${meta?.label ?? "Pet services"}${cityDisplay ? ` in ${cityDisplay}` : ""}`;
  useSeo({
    title,
    description: `Find ${providers.length}+ ${meta?.label.toLowerCase() ?? "pet service"} providers${cityDisplay ? ` in ${cityDisplay}` : ""} on Petos. Verified, reviewed, ready to book.`,
    type: "website",
    jsonLd: [
      jsonLd.itemList(providers.slice(0, 20).map((p: any) => ({
        name: p.name,
        url: `${window.location.origin}/services/${p.id}`,
        image: p.cover_url ?? undefined,
      }))),
      jsonLd.breadcrumb([
        { name: "Home", url: window.location.origin },
        { name: "Services", url: `${window.location.origin}/services` },
        ...(meta ? [{ name: meta.label, url: `${window.location.origin}/services/${meta.key}` }] : []),
        ...(cityDisplay ? [{ name: cityDisplay, url: window.location.href }] : []),
      ]),
    ],
  });

  return (
    <div className="container-app pad-top-safe pt-4 pb-24 max-w-2xl">
      <header className="flex items-center gap-2 mb-3">
        <Button variant="ghost" size="icon" onClick={() => nav(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="font-display text-2xl leading-tight">{title}</h1>
      </header>

      {!category && (
        <div className="grid grid-cols-3 gap-2 mb-4">
          {SERVICE_CATEGORIES.map((c) => {
            const Icon = c.icon;
            return (
              <Link
                key={c.key}
                to={cityDisplay ? `/services/${c.key}/${cityDisplay.toLowerCase().replace(/\s+/g, "-")}` : `/services/category/${c.key}`}
                className="flex flex-col items-center gap-1 p-3 rounded-2xl border border-hairline bg-card hover:bg-muted/40"
              >
                <Icon className="h-5 w-5 text-primary" />
                <span className="text-[11px] text-center leading-tight">{c.short}</span>
              </Link>
            );
          })}
        </div>
      )}

      <p className="text-sm text-muted-foreground mb-4">
        {providers.length} {providers.length === 1 ? "provider" : "providers"}
        {cityDisplay && (
          <span className="ml-2 inline-flex items-center gap-1">
            <MapPin className="h-3 w-3" /> {cityDisplay}
          </span>
        )}
      </p>

      <GeoBanner onCityChange={(slug) => {
        if (slug && category) nav(`/services/${category}/${slug}`);
        else if (!slug && category && city) nav(`/services/${category}`);
      }} />
      <ListingFilters
        value={filters}
        onChange={(next) => {
          setFilters(next);
          if (next.city && next.city !== filters.city) setCity(next.city);
        }}
        showSpecies={false}
        showBreed={false}
        showAge={false}
        showGender={false}
        showOpenNow
        showSoonestAvailable
      />

      {isLoading ? (
        <div className="text-sm text-muted-foreground py-8 text-center">Loading…</div>
      ) : providers.length === 0 ? (
        <EmptyState
          icon={Stethoscope}
          title="No providers yet"
          description="Try a nearby city or another category."
          ctaLabel="Browse all"
          onCta={() => nav("/services")}
        />
      ) : (
        <div className="space-y-3">
          {providers.map((p: any) => (
            <Link key={p.id} to={`/services/${p.id}`} className="block">
              <Card className="rounded-2xl border-hairline p-3 flex gap-3">
                <div className="h-20 w-20 rounded-xl overflow-hidden bg-muted shrink-0">
                  {p.cover_url ? <SmartImage src={p.cover_url} alt={p.name} aspect="1/1" className="w-full h-full" /> : null}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <div className="font-medium truncate">{p.name}</div>
                    {p.verified && <BadgeCheck className="h-4 w-4 text-primary shrink-0" />}
                  </div>
                  <div className="text-xs text-muted-foreground capitalize">{p.category}</div>
                  {p.city && (
                    <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <MapPin className="h-3 w-3" /> {p.city}
                    </div>
                  )}
                  {p.hourly_rate_inr ? (
                    <div className="text-sm font-display text-primary mt-1">₹{p.hourly_rate_inr}/hr</div>
                  ) : null}
                  {p.distance_km != null && (
                    <DistanceChip distanceKm={Number(p.distance_km)} className="mt-1" />
                  )}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default ServiceCategoryCity;