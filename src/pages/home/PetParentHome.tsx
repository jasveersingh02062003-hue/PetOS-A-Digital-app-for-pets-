import { lazy, Suspense, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useProfile, usePets } from "@/hooks/useProfile";
import { EmptyState } from "@/components/EmptyState";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Heart, Users, Flame, Stethoscope, PawPrint, Briefcase, ShoppingBag, ShieldCheck, Sparkles } from "lucide-react";
import { useSeo } from "@/hooks/useSeo";
import { PetHeroCard } from "@/components/home/PetHeroCard";
import { EmergencyButton } from "@/components/home/EmergencyButton";
import { HealthSetupReminder } from "@/components/health/HealthSetupReminder";

// Below-fold / heavy: lazy-load so first paint isn't blocked
const PostFeed = lazy(() => import("@/components/PostFeed").then((m) => ({ default: m.PostFeed })));
const QuickAccessRail = lazy(() => import("@/components/QuickAccessRail").then((m) => ({ default: m.QuickAccessRail })));
const ProactiveAlertsCard = lazy(() => import("@/components/home/ProactiveAlertsCard").then((m) => ({ default: m.ProactiveAlertsCard })));
const BookingSuggestionsCard = lazy(() => import("@/components/home/BookingSuggestionsCard").then((m) => ({ default: m.BookingSuggestionsCard })));
const StoryRail = lazy(() => import("@/components/social/StoryRail").then((m) => ({ default: m.StoryRail })));
const DailyPromptBanner = lazy(() => import("@/components/social/DailyPromptBanner").then((m) => ({ default: m.DailyPromptBanner })));
const MissingStrip = lazy(() => import("@/components/MissingStrip").then((m) => ({ default: m.MissingStrip })));
const SheltersNearYouRail = lazy(() => import("@/components/home/SheltersNearYouRail").then((m) => ({ default: m.SheltersNearYouRail })));

// Goal → label/icon used to render the "Personalised for" chip strip and to drive section ordering.
const GOAL_META: Record<string, { label: string; Icon: any }> = {
  vet:      { label: "Vet help",  Icon: Stethoscope },
  social:   { label: "Social",    Icon: Users },
  mating:   { label: "Mates",     Icon: PawPrint },
  services: { label: "Services",  Icon: Briefcase },
  shop:     { label: "Shop",      Icon: ShoppingBag },
  vault:    { label: "Health",    Icon: ShieldCheck },
};

/**
 * The original Home — pet-parent dashboard.
 * Hero pet card, SOS, AI alerts, stories, quick-access rail, prompts, missing-pet strip,
 * shelters-near-you, then For-you / Following feed tabs.
 *
 * Sections below the hero are reordered based on the user's onboarding `goals[]`
 * so what each parent picked becomes the most prominent module on Home.
 */
const PetParentHome = () => {
  const nav = useNavigate();
  const { data: profile } = useProfile();
  const { data: pets } = usePets();
  const firstName = profile?.full_name?.split(" ")[0];
  const hasPets = !!pets && pets.length > 0;
  const [tab, setTab] = useState<"for-you" | "following" | "trending">("for-you");
  const goals = ((profile as any)?.goals ?? []) as string[];

  useSeo({ title: "Home", description: "Your daily Petos feed: stories, meetups, health and missing-pet alerts.", noIndex: true });

  // Goal-driven section ordering: surface the modules tied to the user's goals first.
  const orderedSections = useMemo(() => {
    const sections: Record<string, JSX.Element> = {
      booking: (
        <Suspense key="booking" fallback={null}>
          <BookingSuggestionsCard />
          <ProactiveAlertsCard />
        </Suspense>
      ),
      stories: (
        <Suspense key="stories" fallback={<div className="h-[88px]" />}>
          <StoryRail />
        </Suspense>
      ),
      quick: (
        <Suspense key="quick" fallback={<div className="h-20" />}>
          <QuickAccessRail />
        </Suspense>
      ),
      prompt: (
        <Suspense key="prompt" fallback={null}>
          <div className="-mx-4 mt-1"><DailyPromptBanner /></div>
        </Suspense>
      ),
      missing: (
        <Suspense key="missing" fallback={null}>
          <div className="mt-3 mb-4"><MissingStrip /></div>
        </Suspense>
      ),
      shelters: (
        <Suspense key="shelters" fallback={null}>
          <SheltersNearYouRail />
        </Suspense>
      ),
    };

    // Map goal → section keys to pin to the top, in the order the user chose them.
    const goalToSections: Record<string, string[]> = {
      vet:      ["booking"],
      social:   ["stories", "prompt"],
      mating:   ["quick"],          // Mates lives inside QuickAccessRail
      services: ["quick"],
      shop:     ["quick"],
      vault:    ["booking"],
      lost_found: ["missing", "shelters"],
    };

    const pinned: string[] = [];
    goals.forEach((g) => {
      (goalToSections[g] ?? []).forEach((k) => {
        if (!pinned.includes(k) && sections[k]) pinned.push(k);
      });
    });
    const rest = Object.keys(sections).filter((k) => !pinned.includes(k));
    return [...pinned, ...rest].map((k) => sections[k]);
  }, [goals]);

  return (
    <div className="container-app pad-top-safe">
      <header className="pt-6 pb-4">
        <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">
          {new Date().toLocaleDateString(undefined, { weekday: "long" })}
        </div>
        <h1 className="font-display text-[28px] mt-1 leading-tight">
          {firstName ? <>Hi, <span className="text-primary">{firstName}</span></> : "Welcome"}
        </h1>
        {goals.length > 0 && (
          <div className="mt-3 flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1">
              <Sparkles className="h-3 w-3" /> Personalised for
            </span>
            {goals.map((g) => {
              const m = GOAL_META[g];
              if (!m) return null;
              const Icon = m.Icon;
              return (
                <span
                  key={g}
                  className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[11px] font-medium"
                >
                  <Icon className="h-3 w-3" /> {m.label}
                </span>
              );
            })}
          </div>
        )}
      </header>

      <PetHeroCard />
      <HealthSetupReminder variant="compact" />
      <EmergencyButton />

      {orderedSections}

      <section className="pb-10">
        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList className="grid grid-cols-3 w-full rounded-2xl mb-4 h-11 p-1 bg-muted">
            <TabsTrigger value="for-you" className="rounded-xl text-sm">For you</TabsTrigger>
            <TabsTrigger value="following" className="rounded-xl text-sm">
              <Users className="h-3.5 w-3.5 mr-1.5" /> Following
            </TabsTrigger>
            <TabsTrigger value="trending" className="rounded-xl text-sm">
              <Flame className="h-3.5 w-3.5 mr-1.5" /> Trending
            </TabsTrigger>
          </TabsList>
          <TabsContent value="for-you">
            {tab === "for-you" && (
              <Suspense fallback={<div className="h-72 rounded-2xl bg-muted/40 animate-pulse" />}>
              <PostFeed
                scope="all"
                emptyState={
                  <EmptyState
                    icon={Heart}
                    title="Your feed starts with a moment"
                    description={
                      hasPets
                        ? `Share ${pets![0].name}'s day — a photo, a milestone, or a question.`
                        : "Add your first pet to start sharing photos and following other pets."
                    }
                    ctaLabel={hasPets ? "Share a moment" : "Add your first pet"}
                    onCta={() => hasPets
                      ? window.dispatchEvent(new CustomEvent("petos:open-composer"))
                      : nav("/onboarding")}
                    secondaryLabel="Explore Discover"
                    onSecondary={() => nav("/discover")}
                  />
                }
              />
              </Suspense>
            )}
          </TabsContent>
          <TabsContent value="following">
            {tab === "following" && (
              <Suspense fallback={<div className="h-72 rounded-2xl bg-muted/40 animate-pulse" />}>
              <PostFeed
                scope="following"
                emptyState={
                  <EmptyState
                    icon={Users}
                    title="Follow other pet parents"
                    description="Tap any avatar in the feed to visit their profile and follow."
                    ctaLabel="Find people"
                    onCta={() => nav("/discover")}
                  />
                }
              />
              </Suspense>
            )}
          </TabsContent>
          <TabsContent value="trending">
            {tab === "trending" && (
              <Suspense fallback={<div className="h-72 rounded-2xl bg-muted/40 animate-pulse" />}>
              <PostFeed
                scope="trending"
                emptyState={
                  <EmptyState
                    icon={Flame}
                    title="Nothing trending yet"
                    description="Posts with the most reactions today will appear here."
                    ctaLabel="Explore Discover"
                    onCta={() => nav("/discover")}
                  />
                }
              />
              </Suspense>
            )}
          </TabsContent>
        </Tabs>
      </section>
    </div>
  );
};

export default PetParentHome;
