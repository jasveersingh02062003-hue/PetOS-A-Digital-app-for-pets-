import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Search as SearchIcon, X, PawPrint, User, Hash, Stethoscope, CalendarDays, Users, Scissors, AlertCircle, FileText } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

const RECENTS_KEY = "petos:recent_searches";

function pushRecent(q: string) {
  if (!q || q.length < 2) return;
  try {
    const arr: string[] = JSON.parse(localStorage.getItem(RECENTS_KEY) || "[]");
    const next = [q, ...arr.filter((x) => x.toLowerCase() !== q.toLowerCase())].slice(0, 8);
    localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
  } catch {}
}

function readRecents(): string[] {
  try { return JSON.parse(localStorage.getItem(RECENTS_KEY) || "[]"); } catch { return []; }
}

const useDebounced = (v: string, ms = 250) => {
  const [d, setD] = useState(v);
  useEffect(() => { const t = setTimeout(() => setD(v), ms); return () => clearTimeout(t); }, [v, ms]);
  return d;
};

type Tab = "all" | "pets" | "people" | "posts" | "tags" | "services" | "vets" | "meetups" | "groups" | "missing";

export default function Search() {
  const [params, setParams] = useSearchParams();
  const nav = useNavigate();
  const [q, setQ] = useState(params.get("q") || "");
  const [tab, setTab] = useState<Tab>((params.get("tab") as Tab) || "all");
  const debounced = useDebounced(q.trim(), 300);

  useEffect(() => { document.title = q ? `${q} — Search · Petos` : "Search · Petos"; }, [q]);

  useEffect(() => {
    const next = new URLSearchParams(params);
    if (debounced) next.set("q", debounced); else next.delete("q");
    next.set("tab", tab);
    setParams(next, { replace: true });
    if (debounced.length >= 2) pushRecent(debounced);
  }, [debounced, tab]); // eslint-disable-line

  const enabled = debounced.length >= 2;
  const like = `%${debounced}%`;

  const { data, isFetching } = useQuery({
    queryKey: ["search-page", debounced],
    enabled,
    queryFn: async () => {
      const [pets, people, posts, tags, providers, vets, meetups, groups, missing] = await Promise.all([
        supabase.rpc("get_pets_public").then((r) => ({
          data: (r.data ?? []).filter((p: any) =>
            (p.name || "").toLowerCase().includes(debounced.toLowerCase()) ||
            (p.breed || "").toLowerCase().includes(debounced.toLowerCase())
          ).slice(0, 24)
        })),
        supabase.rpc("get_profiles_public").then((r) => ({
          data: (r.data ?? []).filter((p: any) =>
            (p.full_name || "").toLowerCase().includes(debounced.toLowerCase()) ||
            (p.city || "").toLowerCase().includes(debounced.toLowerCase())
          ).slice(0, 24)
        })),
        supabase.from("posts").select("id, caption, image_url, like_count, author_id, created_at").ilike("caption", like).order("created_at", { ascending: false }).limit(24),
        supabase.from("post_hashtags").select("tag").ilike("tag", `%${debounced.replace(/^#/, "")}%`).limit(24),
        supabase.from("service_providers").select("id, name, category, city, cover_url").ilike("name", like).eq("active", true).limit(24),
        supabase.from("vet_profiles").select("user_id, display_name, clinic_name, city, photo_url").or(`display_name.ilike.${like},clinic_name.ilike.${like},city.ilike.${like}`).eq("active", true).limit(24),
        supabase.from("meetups").select("id, title, city, starts_at, cover_url").or(`title.ilike.${like},city.ilike.${like}`).eq("status", "upcoming").order("starts_at", { ascending: true }).limit(24),
        supabase.from("groups").select("id, slug, name, kind, member_count, cover_url").or(`name.ilike.${like},slug.ilike.${like}`).limit(24),
        supabase.from("missing_pets").select("id, photo_url, last_seen_city, last_seen_at, pet_id").ilike("last_seen_city", like).eq("status", "active").order("last_seen_at", { ascending: false }).limit(24),
      ]);

      // Dedupe + uniq tags
      const tagCounts = new Map<string, number>();
      (tags.data ?? []).forEach((t: any) => tagCounts.set(t.tag, (tagCounts.get(t.tag) || 0) + 1));

      return {
        pets: pets.data ?? [],
        people: people.data ?? [],
        posts: posts.data ?? [],
        tags: Array.from(tagCounts, ([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count),
        providers: providers.data ?? [],
        vets: vets.data ?? [],
        meetups: meetups.data ?? [],
        groups: groups.data ?? [],
        missing: missing.data ?? [],
      };
    },
  });

  const recents = useMemo(() => readRecents(), [debounced]);

  const counts = data ? {
    pets: data.pets.length, people: data.people.length, posts: data.posts.length,
    tags: data.tags.length, services: data.providers.length, vets: data.vets.length,
    meetups: data.meetups.length, groups: data.groups.length, missing: data.missing.length,
  } : null;

  const total = counts ? Object.values(counts).reduce((a, b) => a + b, 0) : 0;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b">
        <div className="max-w-2xl mx-auto px-3 py-3 flex items-center gap-2">
          <button onClick={() => nav(-1)} aria-label="Back" className="p-1"><ArrowLeft className="w-5 h-5" /></button>
          <div className="relative flex-1">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search pets, people, posts, #tags…"
              className="pl-9 pr-9 rounded-full"
              inputMode="search"
              enterKeyHint="search"
            />
            {q && (
              <button onClick={() => setQ("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-label="Clear">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-3 py-4 space-y-4">
        {!enabled ? (
          <RecentsAndSuggestions recents={recents} onPick={(s) => setQ(s)} />
        ) : (
          <>
            <div className="text-xs text-muted-foreground">
              {isFetching ? "Searching…" : total === 0 ? "No matches" : `${total} result${total === 1 ? "" : "s"}`}
            </div>

            <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
              <div className="-mx-3 px-3 overflow-x-auto no-scrollbar">
                <TabsList className="bg-muted rounded-xl flex w-max">
                  {([
                    ["all", "All", total],
                    ["pets", "Pets", counts?.pets],
                    ["people", "People", counts?.people],
                    ["posts", "Posts", counts?.posts],
                    ["tags", "#Tags", counts?.tags],
                    ["services", "Services", counts?.services],
                    ["vets", "Vets", counts?.vets],
                    ["meetups", "Meetups", counts?.meetups],
                    ["groups", "Groups", counts?.groups],
                    ["missing", "Missing", counts?.missing],
                  ] as const).map(([k, label, n]) => (
                    <TabsTrigger key={k} value={k} className="rounded-lg whitespace-nowrap">
                      {label}{n ? <span className="ml-1 text-[10px] opacity-70">{n}</span> : null}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>

              <TabsContent value="all" className="mt-4 space-y-5">
                {data && Object.values(counts!).every((n) => n === 0) && <Empty q={debounced} />}
                {!!data?.pets.length && <Section title="Pets"><PetsList items={data.pets} /></Section>}
                {!!data?.people.length && <Section title="People"><PeopleList items={data.people} /></Section>}
                {!!data?.tags.length && <Section title="Hashtags"><TagsList items={data.tags} /></Section>}
                {!!data?.posts.length && <Section title="Posts"><PostsList items={data.posts} /></Section>}
                {!!data?.providers.length && <Section title="Services"><ProvidersList items={data.providers} /></Section>}
                {!!data?.vets.length && <Section title="Vets"><VetsList items={data.vets} /></Section>}
                {!!data?.meetups.length && <Section title="Meetups"><MeetupsList items={data.meetups} /></Section>}
                {!!data?.groups.length && <Section title="Groups"><GroupsList items={data.groups} /></Section>}
                {!!data?.missing.length && <Section title="Missing"><MissingList items={data.missing} /></Section>}
              </TabsContent>

              <TabsContent value="pets" className="mt-4"><PetsList items={data?.pets ?? []} /></TabsContent>
              <TabsContent value="people" className="mt-4"><PeopleList items={data?.people ?? []} /></TabsContent>
              <TabsContent value="posts" className="mt-4"><PostsList items={data?.posts ?? []} /></TabsContent>
              <TabsContent value="tags" className="mt-4"><TagsList items={data?.tags ?? []} /></TabsContent>
              <TabsContent value="services" className="mt-4"><ProvidersList items={data?.providers ?? []} /></TabsContent>
              <TabsContent value="vets" className="mt-4"><VetsList items={data?.vets ?? []} /></TabsContent>
              <TabsContent value="meetups" className="mt-4"><MeetupsList items={data?.meetups ?? []} /></TabsContent>
              <TabsContent value="groups" className="mt-4"><GroupsList items={data?.groups ?? []} /></TabsContent>
              <TabsContent value="missing" className="mt-4"><MissingList items={data?.missing ?? []} /></TabsContent>
            </Tabs>
          </>
        )}
      </main>
    </div>
  );
}

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section>
    <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium mb-2">{title}</div>
    {children}
  </section>
);

const Empty = ({ q }: { q: string }) => (
  <Card className="p-6 text-center text-sm text-muted-foreground rounded-2xl">
    Nothing for <span className="font-medium text-foreground">"{q}"</span>. Try a different word.
  </Card>
);

function RecentsAndSuggestions({ recents, onPick }: { recents: string[]; onPick: (s: string) => void }) {
  const { data: trending } = useQuery({
    queryKey: ["search-trending"],
    queryFn: async () => {
      const { data } = await supabase.from("post_hashtags").select("tag").limit(200);
      const counts = new Map<string, number>();
      (data ?? []).forEach((r: any) => counts.set(r.tag, (counts.get(r.tag) || 0) + 1));
      return Array.from(counts, ([tag, c]) => ({ tag, c })).sort((a, b) => b.c - a.c).slice(0, 12);
    },
  });

  return (
    <div className="space-y-5">
      {recents.length > 0 && (
        <Section title="Recent">
          <div className="flex flex-wrap gap-2">
            {recents.map((r) => (
              <button key={r} onClick={() => onPick(r)} className="px-3 py-1.5 rounded-full bg-muted text-sm hover:bg-muted/70">
                {r}
              </button>
            ))}
          </div>
        </Section>
      )}
      {!!trending?.length && (
        <Section title="Trending hashtags">
          <div className="flex flex-wrap gap-2">
            {trending.map((t) => (
              <Link key={t.tag} to={`/t/${encodeURIComponent(t.tag)}`} className="px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm">
                #{t.tag}
              </Link>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

// --- Result list components ---

function Avatar({ src, fallback }: { src?: string | null; fallback: React.ReactNode }) {
  return src ? (
    <img src={src} alt="" className="h-10 w-10 rounded-full object-cover" loading="lazy" />
  ) : (
    <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground">{fallback}</div>
  );
}

function Row({ to, left, title, subtitle }: { to: string; left: React.ReactNode; title: string; subtitle?: string }) {
  return (
    <Link to={to} className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-muted/60">
      {left}
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium truncate">{title}</div>
        {subtitle && <div className="text-xs text-muted-foreground truncate">{subtitle}</div>}
      </div>
    </Link>
  );
}

const PetsList = ({ items }: { items: any[] }) => items.length ? (
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
    {items.map((p) => (
      <Row key={p.id} to={`/pet/${p.public_id ?? p.id}`}
        left={<Avatar src={p.avatar_url} fallback={<PawPrint className="w-5 h-5" />} />}
        title={p.name} subtitle={[p.breed, p.species, p.city].filter(Boolean).join(" · ")} />
    ))}
  </div>
) : <Empty q="" />;

const PeopleList = ({ items }: { items: any[] }) => items.length ? (
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
    {items.map((p) => (
      <Row key={p.id} to={`/u/${p.id}`}
        left={<Avatar src={p.avatar_url} fallback={<User className="w-5 h-5" />} />}
        title={p.full_name || "Pet parent"} subtitle={p.city || p.bio?.slice(0, 60)} />
    ))}
  </div>
) : <Empty q="" />;

const PostsList = ({ items }: { items: any[] }) => items.length ? (
  <div className="grid grid-cols-3 gap-1">
    {items.map((p) => (
      <Link key={p.id} to={`/?post=${p.id}`} className="aspect-square bg-muted rounded-md overflow-hidden">
        {p.image_url ? <img src={p.image_url} alt="" className="w-full h-full object-cover" loading="lazy" /> :
          <div className="p-2 text-[10px] text-muted-foreground line-clamp-6">{p.caption}</div>}
      </Link>
    ))}
  </div>
) : <Empty q="" />;

const TagsList = ({ items }: { items: { tag: string; count: number }[] }) => items.length ? (
  <div className="flex flex-wrap gap-2">
    {items.map((t) => (
      <Link key={t.tag} to={`/t/${encodeURIComponent(t.tag)}`} className="px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm flex items-center gap-1">
        <Hash className="w-3 h-3" />{t.tag}<span className="opacity-60 text-xs ml-1">{t.count}</span>
      </Link>
    ))}
  </div>
) : <Empty q="" />;

const ProvidersList = ({ items }: { items: any[] }) => items.length ? (
  <div>{items.map((s) => (
    <Row key={s.id} to={`/services/${s.id}`}
      left={<Avatar src={s.cover_url} fallback={<Scissors className="w-5 h-5" />} />}
      title={s.name} subtitle={`${s.category}${s.city ? ` · ${s.city}` : ""}`} />
  ))}</div>
) : <Empty q="" />;

const VetsList = ({ items }: { items: any[] }) => items.length ? (
  <div>{items.map((v) => (
    <Row key={v.user_id} to={`/u/${v.user_id}`}
      left={<Avatar src={v.photo_url} fallback={<Stethoscope className="w-5 h-5" />} />}
      title={v.display_name || "Vet"} subtitle={[v.clinic_name, v.city].filter(Boolean).join(" · ")} />
  ))}</div>
) : <Empty q="" />;

const MeetupsList = ({ items }: { items: any[] }) => items.length ? (
  <div>{items.map((m) => (
    <Row key={m.id} to={`/meetups/${m.id}`}
      left={<Avatar src={m.cover_url} fallback={<CalendarDays className="w-5 h-5" />} />}
      title={m.title}
      subtitle={`${m.city || ""} · ${new Date(m.starts_at).toLocaleDateString()}`} />
  ))}</div>
) : <Empty q="" />;

const GroupsList = ({ items }: { items: any[] }) => items.length ? (
  <div>{items.map((g) => (
    <Row key={g.id} to={`/g/${g.slug}`}
      left={<Avatar src={g.cover_url} fallback={<Users className="w-5 h-5" />} />}
      title={g.name} subtitle={`${g.kind || "group"} · ${g.member_count || 0} members`} />
  ))}</div>
) : <Empty q="" />;

const MissingList = ({ items }: { items: any[] }) => items.length ? (
  <div className="grid grid-cols-3 gap-1">
    {items.map((m) => (
      <Link key={m.id} to={`/missing/${m.id}`} className="aspect-square bg-muted rounded-md overflow-hidden relative">
        {m.photo_url ? <img src={m.photo_url} alt="" className="w-full h-full object-cover" loading="lazy" /> : <AlertCircle className="w-6 h-6 m-auto" />}
        {m.last_seen_city && <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent text-white text-[10px] px-1.5 py-1 truncate">{m.last_seen_city}</div>}
      </Link>
    ))}
  </div>
) : <Empty q="" />;
