import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, MapPin, Search, Navigation } from "lucide-react";
import { useSeo } from "@/hooks/useSeo";
import { jsonLd } from "@/lib/seo";
import { RatingSummary } from "@/components/trust/RatingSummary";
import { useUserLocation } from "@/hooks/useUserLocation";
import { DistanceChip } from "@/components/marketplace/DistanceChip";

type Breeder = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  city: string | null;
  bio: string | null;
  account_type: string | null;
  handle: string | null;
  lat?: number | null;
  lng?: number | null;
};

export default function Breeders() {
  const [list, setList] = useState<Breeder[]>([]);
  const [q, setQ] = useState("");
  const [city, setCity] = useState("");
  const [loading, setLoading] = useState(true);
  const [nearest, setNearest] = useState(true);
  const { coords } = useUserLocation();

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url, city, bio, account_type, handle, lat, lng")
        .eq("breeder_verified", true)
        .order("updated_at", { ascending: false })
        .limit(200);
      setList((data as any) ?? []);
      setLoading(false);
    })();
  }, []);

  const cities = useMemo(
    () => Array.from(new Set(list.map((b) => b.city).filter(Boolean))) as string[],
    [list],
  );

  const distanceFor = (b: Breeder): number | null => {
    if (!coords || b.lat == null || b.lng == null) return null;
    const toRad = (x: number) => (x * Math.PI) / 180;
    const R = 6371;
    const dLat = toRad(Number(b.lat) - coords.lat);
    const dLng = toRad(Number(b.lng) - coords.lng);
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(coords.lat)) * Math.cos(toRad(Number(b.lat))) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
  };

  const filtered = list.filter((b) => {
    if (city && b.city !== city) return false;
    if (q) {
      const hay = `${b.full_name ?? ""} ${b.bio ?? ""} ${b.city ?? ""}`.toLowerCase();
      if (!hay.includes(q.toLowerCase())) return false;
    }
    return true;
  });

  const ordered = useMemo(() => {
    if (!nearest || !coords) return filtered;
    return [...filtered].sort((a, b) => {
      const da = distanceFor(a) ?? Infinity;
      const db = distanceFor(b) ?? Infinity;
      return da - db;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, nearest, coords?.lat, coords?.lng]);

  useSeo({
    title: "Verified Breeders & Kennels in India",
    description:
      "Browse Petos-verified breeders and kennels. Each profile is checked for licensing, vaccination practices and ethical breeding.",
    canonical: `${window.location.origin}/breeders`,
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "ItemList",
        itemListElement: filtered.slice(0, 50).map((b, i) => ({
          "@type": "ListItem",
          position: i + 1,
          url: `${window.location.origin}/org/${b.id}`,
          name: b.full_name ?? "Breeder",
        })),
      },
      jsonLd.breadcrumb([
        { name: "Petos", url: window.location.origin },
        { name: "Breeders", url: `${window.location.origin}/breeders` },
      ]),
    ],
  });

  return (
    <div className="container mx-auto max-w-4xl p-4 pb-24 space-y-4">
      <header className="space-y-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Verified Breeders</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Petos-verified breeders and kennels. Each is reviewed for licensing, vaccination practices and breeding ethics.
        </p>
      </header>

      <div className="flex gap-2 sticky top-0 bg-background/95 backdrop-blur py-2 z-10 flex-wrap">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name, breed or bio"
            className="pl-9"
          />
        </div>
        {cities.length > 0 && (
          <select
            className="border rounded-md px-3 text-sm bg-background"
            value={city}
            onChange={(e) => setCity(e.target.value)}
          >
            <option value="">All cities</option>
            {cities.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        )}
        <button
          onClick={() => setNearest((v) => !v)}
          className={`shrink-0 inline-flex items-center gap-1 h-9 px-3 rounded-md border text-xs font-medium transition ${
            nearest && coords
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-card border-hairline text-muted-foreground"
          }`}
          aria-pressed={nearest}
          title={coords ? "Sort nearest first" : "Enable location to sort nearest first"}
        >
          <Navigation className="h-3.5 w-3.5" />
          Nearest
        </button>
      </div>

      {loading && <div className="text-sm text-muted-foreground p-4">Loading…</div>}
      {!loading && ordered.length === 0 && (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          No verified breeders match your filters yet.
        </Card>
      )}

      <div className="grid sm:grid-cols-2 gap-3">
        {ordered.map((b) => {
          const dist = distanceFor(b);
          return (
          <Link key={b.id} to={`/org/${b.id}`}>
            <Card className="p-4 hover:shadow-md transition flex gap-3 items-start">
              <div className="w-14 h-14 rounded-full bg-muted overflow-hidden grid place-items-center shrink-0">
                {b.avatar_url ? (
                  <img src={b.avatar_url} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" />
                ) : (
                  <span className="text-lg font-semibold">{b.full_name?.[0]?.toUpperCase() ?? "B"}</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold truncate">{b.full_name ?? "Breeder"}</span>
                  <ShieldCheck className="h-4 w-4 text-primary shrink-0" />
                </div>
                {b.handle && <div className="text-xs text-muted-foreground">@{b.handle}</div>}
                {b.city && (
                  <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                    <MapPin className="h-3 w-3" /> {b.city}
                  </div>
                )}
                {dist != null && <DistanceChip distanceKm={dist} className="mt-0.5" />}
                {b.bio && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{b.bio}</p>}
                <Badge variant="secondary" className="mt-2 text-[10px]">
                  {b.account_type || "breeder"}
                </Badge>
                <div className="mt-1.5">
                  <RatingSummary subjectType="pet_partner" subjectId={b.id} />
                </div>
              </div>
            </Card>
          </Link>
          );
        })}
      </div>
    </div>
  );
}