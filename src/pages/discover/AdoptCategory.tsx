import { useEffect, useState, useMemo } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSeo } from "@/hooks/useSeo";
import { jsonLd } from "@/lib/seo";
import { useGeoCity } from "@/hooks/useGeoCity";
import { ListingFilters, type ListingFilterValue } from "@/components/marketplace/ListingFilters";
import { GeoBanner } from "@/components/marketplace/GeoBanner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, MapPin, PawPrint } from "lucide-react";
import { SmartImage } from "@/components/SmartImage";
import { EmptyState } from "@/components/empty/EmptyState";

const cap = (s?: string | null) => s ? s.charAt(0).toUpperCase() + s.slice(1) : "";
const titleFromCity = (slug?: string | null) => slug ? slug.split("-").map(cap).join(" ") : "";

const AdoptCategory = () => {
  const { species, breed, city } = useParams<{ species?: string; breed?: string; city?: string }>();
  const nav = useNavigate();
  const { city: geoCity, displayCity, setCity } = useGeoCity();

  // City precedence: URL → geo
  const effectiveCity = city ?? geoCity ?? undefined;
  const cityDisplay = city ? titleFromCity(city) : displayCity;
  const breedDisplay = breed ? decodeURIComponent(breed) : undefined;

  const [filters, setFilters] = useState<ListingFilterValue>({
    species: species ?? undefined,
    breed: breedDisplay,
    city: cityDisplay ?? undefined,
    sort: "newest",
  });

  useEffect(() => {
    setFilters((f) => ({
      ...f,
      species: species ?? f.species,
      breed: breedDisplay ?? f.breed,
      city: cityDisplay ?? f.city,
    }));
  }, [species, breedDisplay, cityDisplay]);

  const { data: listings = [], isLoading } = useQuery({
    queryKey: ["adopt-cat", filters],
    queryFn: async () => {
      let q = supabase.from("pet_listings").select("*")
        .eq("active", true)
        .eq("status", "active")
        .limit(60);
      if (filters.species) q = q.eq("species", filters.species);
      if (filters.breed) q = q.ilike("breed", `%${filters.breed}%`);
      if (filters.city) q = q.ilike("city", `%${filters.city}%`);
      if (filters.gender) q = q.eq("gender", filters.gender);
      if (filters.priceMin != null) q = q.gte("fee_inr", filters.priceMin);
      if (filters.priceMax != null) q = q.lte("fee_inr", filters.priceMax);
      if (filters.matingOnly) q = q.eq("listing_type", "mate");
      if (filters.ageMonths) {
        const map: Record<string, [number, number | null]> = {
          "0-3": [0, 12], "3-6": [12, 24], "6-12": [24, 52], "12+": [52, null],
        };
        const [lo, hi] = map[filters.ageMonths];
        q = q.gte("age_weeks", lo);
        if (hi != null) q = q.lt("age_weeks", hi);
      }
      if (filters.sort === "price_asc") q = q.order("fee_inr", { ascending: true, nullsFirst: true });
      else if (filters.sort === "price_desc") q = q.order("fee_inr", { ascending: false });
      else q = q.order("created_at", { ascending: false });
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const title = [
    breedDisplay ?? cap(species),
    species && species !== "dog" ? "" : (species === "dog" || breedDisplay ? "puppies & dogs" : ""),
    cityDisplay ? `in ${cityDisplay}` : "",
    "for adoption",
  ].filter(Boolean).join(" ").replace(/\s+/g, " ").trim() || "Pets for adoption";

  useSeo({
    title,
    description: `Browse ${listings.length}+ ${breedDisplay ?? species ?? "pet"} listings${cityDisplay ? ` in ${cityDisplay}` : ""} on Petos. Verified shelters, breeders and pet parents.`,
    type: "website",
    jsonLd: [
      jsonLd.itemList(listings.slice(0, 20).map((l: any) => ({
        name: l.title,
        url: `${window.location.origin}/mates/adopt/${l.id}`,
        image: Array.isArray(l.photos) ? l.photos[0] : undefined,
      }))),
      jsonLd.breadcrumb([
        { name: "Home", url: window.location.origin },
        { name: "Adopt", url: `${window.location.origin}/adopt` },
        ...(species ? [{ name: cap(species), url: `${window.location.origin}/adopt/${species}` }] : []),
        ...(breedDisplay && species ? [{ name: breedDisplay, url: `${window.location.origin}/adopt/${species}/${breed}` }] : []),
        ...(cityDisplay ? [{ name: cityDisplay, url: window.location.href }] : []),
      ]),
    ],
  });

  // Keep URL in sync with filter changes (so users can share links)
  const onFilterChange = (next: ListingFilterValue) => {
    setFilters(next);
    if (next.city && next.city !== filters.city) {
      setCity(next.city);
    }
  };

  return (
    <div className="container-app pad-top-safe pt-4 pb-24 max-w-2xl">
      <header className="flex items-center gap-2 mb-3">
        <Button variant="ghost" size="icon" onClick={() => nav(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="font-display text-2xl leading-tight">
          {title}
        </h1>
      </header>

      <p className="text-sm text-muted-foreground mb-4">
        {listings.length} {listings.length === 1 ? "result" : "results"}
        {cityDisplay && (
          <span className="ml-2 inline-flex items-center gap-1">
            <MapPin className="h-3 w-3" /> {cityDisplay}
          </span>
        )}
      </p>

      <GeoBanner onCityChange={(slug) => {
        if (slug) nav(`/adopt${species ? `/${species}` : ""}${breed ? `/${breed}` : ""}/${slug}`);
        else if (city) nav(`/adopt${species ? `/${species}` : ""}${breed ? `/${breed}` : ""}`);
      }} />
      <ListingFilters
        value={filters}
        onChange={onFilterChange}
        showMatingOnly
      />

      {isLoading ? (
        <div className="text-sm text-muted-foreground py-8 text-center">Loading…</div>
      ) : listings.length === 0 ? (
        <EmptyState
          icon={PawPrint}
          title="No matches"
          description="Try widening your filters or another city."
          ctaLabel="Browse all"
          onCta={() => nav("/adopt")}
        />
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {listings.map((l: any) => {
            const photo = Array.isArray(l.photos) && l.photos.length ? l.photos[0] : null;
            const isFree = l.listing_type === "adoption" || !l.fee_inr;
            return (
              <Link key={l.id} to={`/mates/adopt/${l.id}`} className="block">
                <Card className="rounded-2xl border-hairline overflow-hidden">
                  <div className="aspect-square bg-muted">
                    {photo ? <SmartImage src={photo} alt={l.title} aspect="1/1" className="w-full h-full" /> : null}
                  </div>
                  <div className="p-2.5">
                    <div className="flex items-start justify-between gap-1">
                      <div className="text-sm font-medium truncate flex-1">{l.title}</div>
                      {l.listing_type === "breeder_sale" && <Badge variant="secondary" className="text-[9px] px-1.5 py-0">Breeder</Badge>}
                    </div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      {[l.breed ?? l.species, l.city].filter(Boolean).join(" · ")}
                    </div>
                    <div className="text-sm font-display mt-1">
                      {isFree ? <span className="text-leaf">Free</span> : <span className="text-primary">₹{l.fee_inr.toLocaleString("en-IN")}</span>}
                    </div>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AdoptCategory;