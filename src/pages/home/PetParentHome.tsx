import { lazy, Suspense, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useProfile, usePets } from "@/hooks/useProfile";
import { EmptyState } from "@/components/EmptyState";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Heart, Users, Flame } from "lucide-react";
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

/**
 * The original Home — pet-parent dashboard.
 * Hero pet card, SOS, AI alerts, stories, quick-access rail, prompts, missing-pet strip,
 * shelters-near-you, then For-you / Following feed tabs.
 */
const PetParentHome = () => {
  const nav = useNavigate();
  const { data: profile } = useProfile();
  const { data: pets } = usePets();
  const firstName = profile?.full_name?.split(" ")[0];
  const hasPets = !!pets && pets.length > 0;
  const [tab, setTab] = useState<"for-you" | "following" | "trending">("for-you");

  useSeo({ title: "Home", description: "Your daily Petos feed: stories, meetups, health and missing-pet alerts.", noIndex: true });

  return (
    <div className="container-app pad-top-safe">
      <header className="pt-6 pb-4">
        <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">
          {new Date().toLocaleDateString(undefined, { weekday: "long" })}
        </div>
        <h1 className="font-display text-[28px] mt-1 leading-tight">
          {firstName ? <>Hi, <span className="text-primary">{firstName}</span></> : "Welcome"}
        </h1>
      </header>

      <PetHeroCard />
      <HealthSetupReminder variant="compact" />
      <EmergencyButton />
      <Suspense fallback={null}>
        <BookingSuggestionsCard />
        <ProactiveAlertsCard />
      </Suspense>

      <Suspense fallback={<div className="h-[88px]" />}>
        <StoryRail />
      </Suspense>

      <Suspense fallback={<div className="h-20" />}>
        <QuickAccessRail />
      </Suspense>

      <Suspense fallback={null}>
        <div className="-mx-4 mt-1"><DailyPromptBanner /></div>
        <div className="mt-3 mb-4"><MissingStrip /></div>
        <SheltersNearYouRail />
      </Suspense>

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
