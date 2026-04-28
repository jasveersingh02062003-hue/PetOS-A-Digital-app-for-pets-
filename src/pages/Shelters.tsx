import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { useSeo } from "@/hooks/useSeo";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Heart, MapPin, Search, ArrowLeft, HandHeart, PawPrint, Globe } from "lucide-react";
import { toast } from "sonner";

type Org = {
  user_id: string;
  org_name: string;
  org_type: string;
  city: string | null;
  description: string | null;
  facility_photos: string[] | null;
  donation_upi: string | null;
  donation_url: string | null;
  website: string | null;
};

type Sort = "nearby" | "name" | "urgent";

const Shelters = () => {
  const nav = useNavigate();
  const { data: profile } = useProfile();
  const myCity = profile?.city ?? null;
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>("nearby");
  const [type, setType] = useState<"all" | "shelter" | "sanctuary" | "rescuer" | "zoo">("all");

  useSeo({
    title: "Shelters & rescues near you",
    description: "Discover verified shelters, sanctuaries and rescues. Adopt, volunteer or donate.",
  });

  const { data: orgs, isLoading } = useQuery({
    queryKey: ["shelters-directory", type],
    queryFn: async () => {
      const types = (type === "all"
        ? (["shelter", "sanctuary", "rescuer", "zoo"] as const)
        : ([type] as const));
      const { data } = await supabase
        .from("org_profiles")
        .select("user_id, org_name, org_type, city, description, facility_photos, donation_upi, donation_url, website")
        .eq("status", "approved")
        .in("org_type", types)
        .limit(200);
      return (data ?? []) as Org[];
    },
  });

  const ids = useMemo(() => (orgs ?? []).map((o) => o.user_id), [orgs]);

  const { data: counts } = useQuery({
    queryKey: ["shelter-listing-counts", ids],
    enabled: ids.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("pet_listings")
        .select("owner_id")
        .in("owner_id", ids)
        .eq("active", true)
        .eq("status", "active")
        .eq("listing_type", "adoption");
      const map: Record<string, number> = {};
      (data ?? []).forEach((r: any) => {
        map[r.owner_id] = (map[r.owner_id] ?? 0) + 1;
      });
      return map;
    },
  });

  const filtered = useMemo(() => {
    let list = orgs ?? [];
    const term = q.trim().toLowerCase();
    if (term) {
      list = list.filter(
        (o) =>
          o.org_name?.toLowerCase().includes(term) ||
          o.city?.toLowerCase().includes(term) ||
          o.description?.toLowerCase().includes(term),
      );
    }
    const withMeta = list.map((o) => ({ ...o, available: counts?.[o.user_id] ?? 0 }));
    if (sort === "name") {
      withMeta.sort((a, b) => a.org_name.localeCompare(b.org_name));
    } else if (sort === "urgent") {
      withMeta.sort((a, b) => b.available - a.available);
    } else {
      withMeta.sort((a, b) => {
        const sa = myCity && a.city?.toLowerCase() === myCity.toLowerCase() ? 0 : 1;
        const sb = myCity && b.city?.toLowerCase() === myCity.toLowerCase() ? 0 : 1;
        if (sa !== sb) return sa - sb;
        return b.available - a.available;
      });
    }
    return withMeta;
  }, [orgs, counts, q, sort, myCity]);

  const copyUpi = (upi: string) => {
    navigator.clipboard.writeText(upi);
    toast.success("UPI copied");
  };

  return (
    <div className="container-app pad-top-safe pb-24 max-w-2xl">
      <button onClick={() => nav(-1)} className="flex items-center gap-1 text-sm text-muted-foreground mb-3 mt-4">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <header className="mb-4">
        <div className="flex items-center gap-2 text-coral mb-1">
          <Heart className="h-4 w-4" fill="currentColor" />
          <span className="text-[11px] uppercase tracking-[0.18em] font-semibold">Shelters & rescues</span>
        </div>
        <h1 className="font-display text-[26px] leading-tight">Find a shelter to support</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Verified organisations {myCity ? `near ${myCity}` : "across India"} — adopt, volunteer or donate directly.
        </p>
      </header>

      <div className="relative mb-3">
        <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name or city"
          className="pl-9 rounded-2xl h-11"
        />
      </div>

      <div className="flex gap-2 overflow-x-auto no-scrollbar mb-3 pb-1">
        {(["all", "shelter", "sanctuary", "rescuer", "zoo"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setType(t)}
            className={`shrink-0 h-8 px-3 rounded-full text-xs font-medium border transition ${
              type === t ? "bg-foreground text-background border-foreground" : "bg-card text-muted-foreground border-hairline"
            }`}
          >
            {t === "all" ? "All" : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      <div className="flex gap-2 mb-4">
        {([
          { key: "nearby", label: "Nearby" },
          { key: "urgent", label: "Most pets" },
          { key: "name", label: "A–Z" },
        ] as { key: Sort; label: string }[]).map((s) => (
          <button
            key={s.key}
            onClick={() => setSort(s.key)}
            className={`h-7 px-2.5 rounded-full text-[11px] font-medium ${
              sort === s.key ? "bg-coral/15 text-coral" : "text-muted-foreground"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {isLoading && (
        <div className="grid gap-3">
          {[0, 1, 2].map((i) => (
            <Card key={i} className="rounded-2xl h-28 animate-pulse bg-muted/40 border-hairline" />
          ))}
        </div>
      )}

      {!isLoading && filtered.length === 0 && (
        <Card className="rounded-2xl p-6 text-center text-sm text-muted-foreground border-hairline">
          No shelters match your search. Try clearing filters.
        </Card>
      )}

      <div className="grid gap-3">
        {filtered.map((s) => {
          const cover = (s.facility_photos ?? [])[0];
          const hasDonation = !!(s.donation_upi || s.donation_url);
          const sameCity = myCity && s.city?.toLowerCase() === myCity.toLowerCase();
          return (
            <Card key={s.user_id} className="rounded-2xl border-hairline overflow-hidden">
              <div className="flex gap-3 p-3">
                <Link to={`/org/${s.user_id}`} className="shrink-0">
                  <div className="h-20 w-20 rounded-xl overflow-hidden bg-muted">
                    {cover ? (
                      <img src={cover} alt={s.org_name} className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                      <div className="w-full h-full grid place-items-center text-muted-foreground">
                        <PawPrint className="h-6 w-6" />
                      </div>
                    )}
                  </div>
                </Link>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <Link to={`/org/${s.user_id}`} className="font-display text-base leading-tight truncate">
                      {s.org_name}
                    </Link>
                    {sameCity && (
                      <span className="shrink-0 text-[10px] font-semibold text-sky bg-sky/10 px-2 py-0.5 rounded-full">
                        Near you
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5 flex-wrap">
                    {s.city && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {s.city}
                      </span>
                    )}
                    <span className="capitalize">· {s.org_type}</span>
                    {s.available > 0 && (
                      <span className="text-coral font-semibold">· {s.available} available</span>
                    )}
                  </div>
                  {s.description && (
                    <p className="text-[12px] text-muted-foreground mt-1 line-clamp-2">{s.description}</p>
                  )}
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => nav(`/org/${s.user_id}`)}
                      className="h-8 rounded-full px-3 text-xs"
                    >
                      View
                    </Button>
                    {s.donation_upi && (
                      <Button
                        size="sm"
                        asChild
                        className="h-8 rounded-full px-3 text-xs bg-coral hover:bg-coral/90 text-white"
                      >
                        <a
                          href={`upi://pay?pa=${encodeURIComponent(s.donation_upi)}&pn=${encodeURIComponent(s.org_name)}&cu=INR`}
                        >
                          <Heart className="h-3 w-3 mr-1" /> Donate
                        </a>
                      </Button>
                    )}
                    {!s.donation_upi && s.donation_url && (
                      <Button size="sm" asChild className="h-8 rounded-full px-3 text-xs bg-coral hover:bg-coral/90 text-white">
                        <a href={s.donation_url} target="_blank" rel="noreferrer">
                          <Heart className="h-3 w-3 mr-1" /> Donate
                        </a>
                      </Button>
                    )}
                    {s.donation_upi && (
                      <button
                        onClick={() => copyUpi(s.donation_upi!)}
                        className="text-[11px] text-muted-foreground underline-offset-2 hover:underline"
                      >
                        Copy UPI
                      </button>
                    )}
                    {s.website && (
                      <a
                        href={s.website}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] text-muted-foreground flex items-center gap-1 hover:text-foreground"
                      >
                        <Globe className="h-3 w-3" /> Site
                      </a>
                    )}
                    {!hasDonation && (s.org_type === "shelter" || s.org_type === "sanctuary" || s.org_type === "rescuer") && (
                      <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                        <HandHeart className="h-3 w-3" /> Volunteer welcome
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default Shelters;