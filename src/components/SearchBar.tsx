import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Search, PawPrint, Scissors, Package, X, User, Hash, Stethoscope, CalendarDays, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

const useDebounced = (v: string, ms = 250) => {
  const [d, setD] = useState(v);
  useEffect(() => { const t = setTimeout(() => setD(v), ms); return () => clearTimeout(t); }, [v, ms]);
  return d;
};

export const SearchBar = () => {
  const nav = useNavigate();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const debounced = useDebounced(q.trim(), 250);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const { data, isFetching } = useQuery({
    queryKey: ["search-quick", debounced],
    enabled: debounced.length >= 2,
    queryFn: async () => {
      const like = `%${debounced}%`;
      const [pets, people, providers, products, vets, meetups, tags] = await Promise.all([
        supabase.rpc("get_pets_public").then((r) => ({
          data: (r.data ?? []).filter((p: any) =>
            (p.name || "").toLowerCase().includes(debounced.toLowerCase()) ||
            (p.breed || "").toLowerCase().includes(debounced.toLowerCase())
          ).slice(0, 4)
        })),
        supabase.rpc("get_profiles_public").then((r) => ({
          data: (r.data ?? []).filter((p: any) =>
            (p.full_name || "").toLowerCase().includes(debounced.toLowerCase())
          ).slice(0, 4)
        })),
        supabase.from("service_providers").select("id, name, category, city").ilike("name", like).eq("active", true).limit(3),
        supabase.from("shop_products").select("id, title, price_inr").ilike("title", like).eq("active", true).limit(3),
        supabase.from("vet_profiles").select("user_id, display_name, city").ilike("display_name", like).eq("active", true).limit(3),
        supabase.from("meetups").select("id, title, city, starts_at").ilike("title", like).eq("status", "upcoming").limit(3),
        supabase.from("post_hashtags").select("tag").ilike("tag", `%${debounced.replace(/^#/, "")}%`).limit(20),
      ]);
      const tagCounts = new Map<string, number>();
      (tags.data ?? []).forEach((t: any) => tagCounts.set(t.tag, (tagCounts.get(t.tag) || 0) + 1));
      return {
        pets: pets.data ?? [],
        people: people.data ?? [],
        providers: providers.data ?? [],
        products: products.data ?? [],
        vets: vets.data ?? [],
        meetups: meetups.data ?? [],
        tags: Array.from(tagCounts, ([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count).slice(0, 4),
      };
    },
  });

  const goAll = () => {
    if (debounced.length < 2) return;
    nav(`/search?q=${encodeURIComponent(debounced)}`);
    setOpen(false);
  };

  const hasResults = !!data && (data.pets.length || data.people.length || data.providers.length || data.products.length || data.vets.length || data.meetups.length || data.tags.length);

  return (
    <div ref={wrapRef} className="relative">
      <form onSubmit={(e) => { e.preventDefault(); goAll(); }} className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={q}
          onFocus={() => setOpen(true)}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          placeholder="Search pets, people, #tags, services…"
          className="pl-9 pr-9 rounded-full"
          inputMode="search"
          enterKeyHint="search"
        />
        {q && (
          <button type="button" onClick={() => setQ("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-label="Clear">
            <X className="h-4 w-4" />
          </button>
        )}
      </form>

      {open && debounced.length >= 2 && (
        <Card className="absolute z-30 left-0 right-0 mt-2 rounded-2xl border-hairline shadow-lg max-h-[70vh] overflow-y-auto">
          {isFetching && <div className="p-4 text-sm text-muted-foreground">Searching…</div>}
          {!isFetching && !hasResults && <div className="p-4 text-sm text-muted-foreground">No results.</div>}

          {!!data?.pets.length && (
            <Section title="Pets">
              {data.pets.map((p: any) => (
                <Link key={p.id} to={`/pet/${p.public_id ?? p.id}`} onClick={() => setOpen(false)}>
                  <Row icon={PawPrint} title={p.name} subtitle={`${p.breed || p.species}`} />
                </Link>
              ))}
            </Section>
          )}
          {!!data?.people.length && (
            <Section title="People">
              {data.people.map((p: any) => (
                <Link key={p.id} to={`/u/${p.id}`} onClick={() => setOpen(false)}>
                  <Row icon={User} title={p.full_name || "Pet parent"} subtitle={p.city || ""} avatar={p.avatar_url} />
                </Link>
              ))}
            </Section>
          )}
          {!!data?.tags.length && (
            <Section title="Hashtags">
              <div className="px-3 pb-2 flex flex-wrap gap-1.5">
                {data.tags.map((t) => (
                  <Link key={t.tag} to={`/t/${encodeURIComponent(t.tag)}`} onClick={() => setOpen(false)}
                    className="px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs flex items-center gap-1">
                    <Hash className="w-3 h-3" />{t.tag}
                  </Link>
                ))}
              </div>
            </Section>
          )}
          {!!data?.vets.length && (
            <Section title="Vets">
              {data.vets.map((v: any) => (
                <Link key={v.user_id} to={`/u/${v.user_id}`} onClick={() => setOpen(false)}>
                  <Row icon={Stethoscope} title={v.display_name || "Vet"} subtitle={v.city || ""} />
                </Link>
              ))}
            </Section>
          )}
          {!!data?.meetups.length && (
            <Section title="Meetups">
              {data.meetups.map((m: any) => (
                <Link key={m.id} to={`/meetups/${m.id}`} onClick={() => setOpen(false)}>
                  <Row icon={CalendarDays} title={m.title} subtitle={`${m.city || ""} · ${new Date(m.starts_at).toLocaleDateString()}`} />
                </Link>
              ))}
            </Section>
          )}
          {!!data?.providers.length && (
            <Section title="Services">
              {data.providers.map((p: any) => (
                <Link key={p.id} to={`/services/${p.id}`} onClick={() => setOpen(false)}>
                  <Row icon={Scissors} title={p.name} subtitle={`${p.category} · ${p.city || "—"}`} />
                </Link>
              ))}
            </Section>
          )}
          {!!data?.products.length && (
            <Section title="Shop">
              {data.products.map((p: any) => (
                <Link key={p.id} to="/shop" onClick={() => setOpen(false)}>
                  <Row icon={Package} title={p.title} subtitle={`₹${p.price_inr}`} />
                </Link>
              ))}
            </Section>
          )}

          <button onClick={goAll} className="w-full px-3 py-3 text-sm font-medium text-primary border-t border-hairline flex items-center justify-center gap-2 hover:bg-muted/50">
            See all results for "{debounced}" <ArrowRight className="w-4 h-4" />
          </button>
        </Card>
      )}
    </div>
  );
};

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="border-b border-hairline last:border-0">
    <div className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wide text-muted-foreground font-medium">{title}</div>
    {children}
  </div>
);

const Row = ({ icon: Icon, title, subtitle, avatar }: { icon: any; title: string; subtitle: string; avatar?: string | null }) => (
  <div className="px-3 py-2 hover:bg-muted/50 cursor-pointer flex items-center gap-3">
    {avatar ? (
      <img src={avatar} alt="" className="h-8 w-8 rounded-full object-cover" loading="lazy" />
    ) : (
      <div className="h-8 w-8 rounded-lg bg-primary-soft flex items-center justify-center">
        <Icon className="h-4 w-4 text-primary" strokeWidth={1.5} />
      </div>
    )}
    <div className="flex-1 min-w-0">
      <div className="text-sm font-medium truncate">{title}</div>
      <div className="text-xs text-muted-foreground truncate capitalize">{subtitle}</div>
    </div>
  </div>
);
