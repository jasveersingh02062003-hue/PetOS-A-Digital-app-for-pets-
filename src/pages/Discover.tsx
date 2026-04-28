import { useNavigate } from "react-router-dom";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PostFeed } from "@/components/PostFeed";
import { MatesGrid } from "@/components/MatesGrid";
import { SearchBar } from "@/components/SearchBar";
import { EmptyState } from "@/components/EmptyState";
import { LocalPackRail } from "@/components/social/LocalPackRail";
import { TrendingHashtagsRail } from "@/components/social/TrendingHashtagsRail";
import { NearMePanel } from "@/components/maps/NearMePanel";
import {
  Compass, Flame, Users, CalendarDays, Stethoscope, Camera, Sparkles, Heart, ArrowRight, Scissors,
} from "lucide-react";
import { useSeo } from "@/hooks/useSeo";

const Discover = () => {
  const nav = useNavigate();
  useSeo({
    title: "Discover pets, mates and stories",
    description: "Find verified breeding partners, trusted vets, meetups and trending pet stories near you.",
  });
  return (
    <div className="container-app pad-top-safe">
      <header className="pt-6 pb-4">
        <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">Explore</div>
        <h1 className="font-display text-[28px] mt-1 leading-tight">Discover</h1>
        <p className="text-sm text-muted-foreground mt-1">Pets, mates and stories from your city.</p>
      </header>

      <div className="mb-5">
        <SearchBar />
      </div>

      <TrendingHashtagsRail />

      <LocalPackRail />

      {/* TWO HERO CARDS — the engagement engines, not buried in a 6-tile grid */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        <HeroTile
          tone="coral"
          title="Find a mate"
          subtitle="Verified pets near you"
          icon={Heart}
          onClick={() => nav("/mates")}
        />
        <HeroTile
          tone="sky"
          title="Services near you"
          subtitle="Grooming, vets, training & more"
          icon={Scissors}
          onClick={() => nav("/discover/services")}
        />
      </div>

      {/* SECONDARY scrollable rail — colored chips */}
      <div className="-mx-5 mb-5">
        <div className="flex gap-2 overflow-x-auto px-5 no-scrollbar">
          <ChipTile tone="sky" icon={Stethoscope} title="Ask a vet" onClick={() => nav("/askvet")} />
          <ChipTile tone="lilac" icon={Sparkles} title="AI chat" onClick={() => nav("/ai")} />
          <ChipTile tone="lilac" icon={Camera} title="Photo vet" onClick={() => nav("/photo-vet")} />
          <ChipTile tone="amber" icon={CalendarDays} title="Meetups" onClick={() => nav("/meetups")} />
          <ChipTile tone="primary" icon={Users} title="Groups" onClick={() => nav("/groups")} />
          <ChipTile tone="emergency" icon={Compass} title="Missing" onClick={() => nav("/missing")} />
        </div>
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

const TONE_HERO: Record<string, string> = {
  coral: "from-coral/20 via-card to-coral/5 border-coral/25 text-coral",
  sky:   "from-sky/20 via-card to-sky/5 border-sky/25 text-sky",
};
const HeroTile = ({
  title, subtitle, icon: Icon, tone, onClick,
}: { title: string; subtitle: string; icon: any; tone: string; onClick: () => void }) => (
  <button
    onClick={onClick}
    className={`text-left rounded-3xl border bg-gradient-to-br ${TONE_HERO[tone]} p-4 active:scale-[0.98] transition-transform card-elev`}
  >
    <div className="h-9 w-9 rounded-xl bg-background/80 grid place-items-center mb-3">
      <Icon className="h-4 w-4" strokeWidth={2.2} />
    </div>
    <div className="font-display text-base text-foreground leading-tight">{title}</div>
    <div className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</div>
    <div className={`mt-3 text-[11px] font-semibold inline-flex items-center gap-1`}>
      Open <ArrowRight className="h-3 w-3" />
    </div>
  </button>
);

const TONE_CHIP: Record<string, string> = {
  lilac:    "bg-lilac/10 text-lilac",
  amber:    "bg-amber/15 text-amber",
  primary:  "bg-primary/10 text-primary",
  emergency:"bg-emergency/10 text-emergency",
};
const ChipTile = ({ title, icon: Icon, tone, onClick }: { title: string; icon: any; tone: string; onClick: () => void }) => (
  <button
    onClick={onClick}
    className={`shrink-0 inline-flex items-center gap-1.5 px-3 h-10 rounded-full font-semibold text-sm ${TONE_CHIP[tone]} active:scale-95 transition-transform`}
  >
    <Icon className="h-4 w-4" strokeWidth={2.2} />
    {title}
  </button>
);

export default Discover;
