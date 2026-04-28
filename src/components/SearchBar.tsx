import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Search, PawPrint, Scissors, Package, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

const useDebounced = (v: string, ms = 250) => {
  const [d, setD] = useState(v);
  useEffect(() => {
    const t = setTimeout(() => setD(v), ms);
    return () => clearTimeout(t);
  }, [v, ms]);
  return d;
};

export const SearchBar = () => {
  const [q, setQ] = useState("");
  const debounced = useDebounced(q.trim(), 250);

  const { data, isFetching } = useQuery({
    queryKey: ["search", debounced],
    queryFn: async () => {
      const like = `%${debounced}%`;
      const [pets, providers, products] = await Promise.all([
        supabase.from("pets").select("id, name, breed, species, avatar_url").or(`name.ilike.${like},breed.ilike.${like}`).limit(5),
        supabase.from("service_providers").select("id, name, category, city").ilike("name", like).eq("active", true).limit(5),
        supabase.from("shop_products").select("id, title, price_inr, image_url").ilike("title", like).eq("active", true).limit(5),
      ]);
      return {
        pets: pets.data ?? [],
        providers: providers.data ?? [],
        products: products.data ?? [],
      };
    },
    enabled: debounced.length >= 2,
  });

  const hasResults =
    data && (data.pets.length || data.providers.length || data.products.length);

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search pets, services, products…"
          className="pl-9 pr-9 rounded-full"
        />
        {q && (
          <button
            onClick={() => setQ("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {debounced.length >= 2 && (
        <Card className="absolute z-30 left-0 right-0 mt-2 rounded-2xl border-hairline shadow-lg max-h-[60vh] overflow-y-auto">
          {isFetching && <div className="p-4 text-sm text-muted-foreground">Searching…</div>}
          {!isFetching && !hasResults && (
            <div className="p-4 text-sm text-muted-foreground">No results.</div>
          )}
          {!!data?.pets.length && (
            <Section title="Pets">
              {data.pets.map((p) => (
                <Row key={p.id} icon={PawPrint} title={p.name} subtitle={`${p.breed || p.species}`} />
              ))}
            </Section>
          )}
          {!!data?.providers.length && (
            <Section title="Services">
              {data.providers.map((p) => (
                <Link key={p.id} to={`/services/${p.id}`} onClick={() => setQ("")}>
                  <Row icon={Scissors} title={p.name} subtitle={`${p.category} · ${p.city || "—"}`} />
                </Link>
              ))}
            </Section>
          )}
          {!!data?.products.length && (
            <Section title="Shop">
              {data.products.map((p) => (
                <Link key={p.id} to="/shop" onClick={() => setQ("")}>
                  <Row icon={Package} title={p.title} subtitle={`₹${p.price_inr}`} />
                </Link>
              ))}
            </Section>
          )}
        </Card>
      )}
    </div>
  );
};

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="border-b border-hairline last:border-0">
    <div className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
      {title}
    </div>
    {children}
  </div>
);

const Row = ({ icon: Icon, title, subtitle }: { icon: any; title: string; subtitle: string }) => (
  <div className="px-3 py-2 hover:bg-muted/50 cursor-pointer flex items-center gap-3">
    <div className="h-8 w-8 rounded-lg bg-primary-soft flex items-center justify-center">
      <Icon className="h-4 w-4 text-primary" strokeWidth={1.5} />
    </div>
    <div className="flex-1 min-w-0">
      <div className="text-sm font-medium truncate">{title}</div>
      <div className="text-xs text-muted-foreground truncate capitalize">{subtitle}</div>
    </div>
  </div>
);
