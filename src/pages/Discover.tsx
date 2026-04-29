import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PostFeed } from "@/components/PostFeed";
import { MatesGrid } from "@/components/MatesGrid";
import { SearchBar } from "@/components/SearchBar";
import { EmptyState } from "@/components/EmptyState";
import { LocalPackRail } from "@/components/social/LocalPackRail";
import { TrendingHashtagsRail } from "@/components/social/TrendingHashtagsRail";
import { NearMePanel } from "@/components/maps/NearMePanel";
import {
  Compass, Flame, Users, CalendarDays, Stethoscope, Heart, ArrowRight,
  Scissors, GraduationCap, Hotel, Sun, Home, Footprints, Car, AlertTriangle,
  MapPin, Sparkles, ShoppingBag, Baby, Bell,
  type LucideIcon,
} from "lucide-react";
import { useSeo } from "@/hooks/useSeo";
import { useUserLocation } from "@/hooks/useUserLocation";

type TileTone = "coral" | "sky" | "leaf" | "amber" | "lilac" | "primary" | "emergency";
type ServiceKey =
  | "grooming" | "vet_clinic" | "training" | "boarding" | "daycare"
  | "caretaker" | "sitting" | "walking" | "pet_taxi";
type Tile = {
  key: string;
  title: string;
  subtitle: string;
  icon: LucideIcon;
  tone: TileTone;
  to: string;
  serviceKey?: ServiceKey; // when set we show "X near you"
};

const TILES: Tile[] = [
  { key: "mate",      title: "Find a mate",      subtitle: "Verified pets near you",        icon: Heart,        tone: "coral",     to: "/mates" },
  { key: "askvet",    title: "Ask a vet",        subtitle: "Verified Q&A in minutes",       icon: Stethoscope,  tone: "sky",       to: "/askvet" },
  { key: "grooming",  title: "Grooming",         subtitle: "Baths, haircuts & spa",         icon: Scissors,     tone: "coral",     to: "/services/category/grooming",  serviceKey: "grooming" },
  { key: "vet_clinic",title: "Vet clinics",      subtitle: "In-person clinics nearby",      icon: Stethoscope,  tone: "sky",       to: "/services/category/vet_clinic",serviceKey: "vet_clinic" },
  { key: "daycare",   title: "Daycare",          subtitle: "Daytime drop-off care",         icon: Sun,          tone: "amber",     to: "/services/category/daycare",   serviceKey: "daycare" },
  { key: "caretaker", title: "Caretakers",       subtitle: "Long-term in-home care",        icon: Home,         tone: "leaf",      to: "/services/category/caretaker", serviceKey: "caretaker" },
  { key: "training",  title: "Training centers", subtitle: "Obedience & puppy schools",     icon: GraduationCap,tone: "amber",     to: "/services/category/training",  serviceKey: "training" },
  { key: "boarding",  title: "Boarding",         subtitle: "Overnight stays nearby",        icon: Hotel,        tone: "lilac",     to: "/services/category/boarding",  serviceKey: "boarding" },
  { key: "sitting",   title: "Sitters",          subtitle: "Drop-ins & check-ups",          icon: Heart,        tone: "coral",     to: "/services/category/sitting",   serviceKey: "sitting" },
  { key: "walking",   title: "Walkers",          subtitle: "Daily walks & exercise",        icon: Footprints,   tone: "leaf",      to: "/services/category/walking",   serviceKey: "walking" },
  { key: "pet_taxi",  title: "Pet taxi",         subtitle: "Book a verified driver",        icon: Car,          tone: "primary",   to: "/taxi",                        serviceKey: "pet_taxi" },
  { key: "pregnancy", title: "Pregnancy",        subtitle: "Track gestation & whelping",    icon: Baby,         tone: "lilac",     to: "/pregnancies" },
  { key: "reorder",   title: "Reorder reminders",subtitle: "Never run out of food or meds", icon: Bell,         tone: "leaf",      to: "/shop/reminders" },
  { key: "meetups",   title: "Meetups",          subtitle: "Local events & playdates",      icon: CalendarDays, tone: "amber",     to: "/meetups" },
  { key: "groups",    title: "Groups",           subtitle: "Communities by breed & city",   icon: Users,        tone: "primary",   to: "/groups" },
  { key: "missing",   title: "Missing pets",     subtitle: "Help reunite pets nearby",      icon: AlertTriangle,tone: "emergency", to: "/missing" },
];

const Discover = () => {
  const nav = useNavigate();
  const { coords, city } = useUserLocation() as any;
  useSeo({
    title: "Discover pets, mates and stories",
    description: "Find verified breeding partners, trusted vets, meetups and trending pet stories near you.",
  });

  // ONE batched query — counts grouped by category for all service tiles
  const { data: counts } = useQuery({
    queryKey: ["discover-nearby-counts", coords?.lat, coords?.lng],
    enabled: !!coords,
    queryFn: async () => {
      const { data } = await supabase.rpc("nearby_providers" as any, {
        _lat: coords!.lat,
        _lng: coords!.lng,
        _radius_km: 25,
      });
      const map: Record<string, number> = {};
      for (const row of (data as any[]) ?? []) {
        const k = String(row.category);
        map[k] = (map[k] ?? 0) + 1;
      }
      return map;
    },
  });

  return (
    <div className="container-app pad-top-safe">
      {/* Hero */}
      <header className="pt-6 pb-4 relative">
        <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-primary/8 via-coral/5 to-transparent rounded-b-[32px] -z-10" />
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground font-semibold inline-flex items-center gap-1.5">
              <Sparkles className="h-3 w-3" /> Explore
            </div>
            <h1 className="font-display text-[30px] mt-1 leading-tight">Discover</h1>
          </div>
          {coords && (
            <button
              onClick={() => nav("/settings/about")}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-card border border-hairline text-xs font-medium hover:bg-muted/40"
            >
              <MapPin className="h-3.5 w-3.5 text-primary" />
              <span className="truncate max-w-[120px]">{city || "Near you"}</span>
            </button>
          )}
        </div>
        <p className="text-sm text-muted-foreground mt-1">Everything for your pet — scroll, tap, done.</p>
      </header>

      <div className="mb-5">
        <SearchBar />
        <div className="mt-2 flex flex-wrap gap-1.5">
          {["#puppies", "#adoption", "grooming", "vets near me"].map((s) => (
            <button
              key={s}
              onClick={() => nav(`/search?q=${encodeURIComponent(s.replace(/^#/, ""))}`)}
              className="text-[11px] px-2.5 py-1 rounded-full bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            >
              {s}
            </button>
          ))}
        </div>

        {/* Browse by role — entity-type chip rail wired to Search */}
        <div className="mt-3 -mx-1">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold mb-1.5 px-1">Browse by role</div>
          <div className="overflow-x-auto no-scrollbar">
            <div className="flex gap-1.5 w-max px-1">
              {[
                { key: "breeder", label: "Breeders" },
                { key: "kennel", label: "Kennels" },
                { key: "shelter", label: "Shelters" },
                { key: "sanctuary", label: "Sanctuaries" },
                { key: "zoo", label: "Zoos" },
                { key: "rescuer", label: "Rescuers" },
                { key: "vet", label: "Vets" },
                { key: "provider", label: "Providers" },
              ].map((r) => (
                <button
                  key={r.key}
                  onClick={() => nav(`/search?tab=people&role=${r.key}`)}
                  className="shrink-0 h-8 px-3 rounded-full text-xs font-medium border bg-card text-muted-foreground border-hairline hover:text-foreground"
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <TrendingHashtagsRail />
      <LocalPackRail />

      {/* BIG-BOX GRID — the new primary discovery surface */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        {TILES.map((t) => (
          <BigTile
            key={t.key}
            tile={t}
            count={t.serviceKey ? counts?.[t.serviceKey] : undefined}
            locationOn={!!coords}
            onClick={() => nav(t.to)}
          />
        ))}
      </div>

      <Tabs defaultValue="trending" className="w-full">
        <TabsList className="grid grid-cols-4 w-full bg-muted rounded-2xl mb-5 h-11 p-1">
          <TabsTrigger value="trending" className="rounded-xl text-xs">Trending</TabsTrigger>
          <TabsTrigger value="latest" className="rounded-xl text-xs">Latest</TabsTrigger>
          <TabsTrigger value="nearby" className="rounded-xl text-xs">Near me</TabsTrigger>
          <TabsTrigger value="mates" className="rounded-xl text-xs">Mates</TabsTrigger>
        </TabsList>

        <TabsContent value="trending" className="pb-10">
          <PostFeed
            scope="trending"
            emptyState={
              <EmptyState
                icon={Flame}
                title="Trending posts will appear here"
                description="As pet parents share moments and react to each other, the most-loved posts of the week land here."
                ctaLabel="Share the first moment"
                onCta={() => nav("/")}
              />
            }
          />
        </TabsContent>

        <TabsContent value="latest" className="pb-10">
          <PostFeed
            scope="all"
            emptyState={
              <EmptyState
                icon={Compass}
                title="Be the first to post"
                description="Latest posts from across Petos show up here. Get the feed started — your pet's photo can be the cover of someone's day."
                ctaLabel="Share a moment"
                onCta={() => nav("/")}
              />
            }
          />
        </TabsContent>

        <TabsContent value="nearby" className="pb-10"><NearMePanel /></TabsContent>
        <TabsContent value="mates" className="pb-10"><MatesGrid /></TabsContent>
      </Tabs>
    </div>
  );
};

const TONE_GRADIENT: Record<TileTone, string> = {
  coral:     "from-coral/25 via-card to-coral/5 border-coral/25 text-coral",
  sky:       "from-sky/25 via-card to-sky/5 border-sky/25 text-sky",
  leaf:      "from-leaf/25 via-card to-leaf/5 border-leaf/25 text-leaf",
  amber:     "from-amber/25 via-card to-amber/5 border-amber/25 text-amber",
  lilac:     "from-lilac/25 via-card to-lilac/5 border-lilac/25 text-lilac",
  primary:   "from-primary/20 via-card to-primary/5 border-primary/25 text-primary",
  emergency: "from-emergency/20 via-card to-emergency/5 border-emergency/25 text-emergency",
};

const BigTile = ({
  tile, count, locationOn, onClick,
}: { tile: Tile; count?: number; locationOn: boolean; onClick: () => void }) => {
  const Icon = tile.icon;
  return (
    <button
      onClick={onClick}
      className={`text-left rounded-3xl border bg-gradient-to-br ${TONE_GRADIENT[tile.tone]} p-4 min-h-[140px] flex flex-col active:scale-[0.98] transition-transform card-elev`}
    >
      <div className="h-10 w-10 rounded-xl bg-background/80 grid place-items-center mb-3">
        <Icon className="h-5 w-5" strokeWidth={2.2} />
      </div>
      <div className="font-display text-[15px] text-foreground leading-tight">{tile.title}</div>
      <div className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{tile.subtitle}</div>
      <div className="mt-auto pt-2 flex items-center justify-between">
        <span className="text-[11px] font-semibold inline-flex items-center gap-1">
          Open <ArrowRight className="h-3 w-3" />
        </span>
        {tile.serviceKey && locationOn && typeof count === "number" && count > 0 && (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-background/80 text-foreground">
            {count} near you
          </span>
        )}
      </div>
    </button>
  );
};

export default Discover;
