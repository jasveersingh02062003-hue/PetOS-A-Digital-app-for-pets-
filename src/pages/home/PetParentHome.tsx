import { lazy, Suspense, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useProfile, usePets } from "@/hooks/useProfile";
import { EmptyState } from "@/components/EmptyState";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Heart, Users, MapPin, Sparkles } from "lucide-react";
import { useSeo } from "@/hooks/useSeo";
import { HomeTopBar } from "@/components/social/HomeTopBar";
import { TodayPanel } from "@/components/social/TodayPanel";

// Lazy: keep first paint cheap — only the bar + rail + active tab render eagerly
const PostFeed = lazy(() =>
  import("@/components/PostFeed").then((m) => ({ default: m.PostFeed })),
);
const StoryRail = lazy(() =>
  import("@/components/social/StoryRail").then((m) => ({ default: m.StoryRail })),
);
const DailyPromptBanner = lazy(() =>
  import("@/components/social/DailyPromptBanner").then((m) => ({ default: m.DailyPromptBanner })),
);
const MissingStrip = lazy(() =>
  import("@/components/MissingStrip").then((m) => ({ default: m.MissingStrip })),
);

/**
 * Pet-parent Home — the "stop being a clone" rebuild.
 *
 * Above-the-fold is now THREE elements only:
 *
 *   1. Brand bar  (Petos wordmark + search + bell + avatar→Today panel)
 *   2. Story rail (pets you follow that posted today)
 *   3. Tabs       (For you · Tribe · Nearby)
 *
 * Everything else from the old dashboard — pet hero card, "Hi joe" greeting,
 * goal chip strip, SOS ribbon, composer card, 6-icon quick grid — has moved
 * into the swipe-down `TodayPanel`, accessible by tapping the avatar in the
 * brand bar. This makes the feed itself the protagonist.
 *
 * Tribe & Nearby are powered by SECURITY DEFINER RPCs (`get_tribe_posts`,
 * `get_nearby_posts`) that union breed/city/group signals — these are the
 * differentiators no other pet social can match because no one else has
 * verified pet+breed+city data.
 */
const PetParentHome = () => {
  const nav = useNavigate();
  const { data: profile } = useProfile();
  const { data: pets } = usePets();
  const hasPets = !!pets && pets.length > 0;
  const [tab, setTab] = useState<"for-you" | "tribe" | "nearby">("for-you");
  const [todayOpen, setTodayOpen] = useState(false);
  const cityKnown = !!profile?.city;

  useSeo({
    title: "Petos",
    description: "A social home for pets — stories, moments, your tribe and what's happening near you.",
    noIndex: true,
  });

  return (
    <div className="container-app pad-top-safe">
      <HomeTopBar onAvatarClick={() => setTodayOpen(true)} />

      <div className="mt-2">
        <Suspense fallback={<div className="h-[88px]" />}>
          <StoryRail />
        </Suspense>
      </div>

      <Suspense fallback={null}>
        <div className="-mx-4 mt-1">
          <DailyPromptBanner />
        </div>
      </Suspense>

      <Suspense fallback={null}>
        <div className="mt-3 mb-2">
          <MissingStrip />
        </div>
      </Suspense>

      <section className="pb-10 mt-2">
        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList className="grid grid-cols-3 w-full rounded-2xl mb-4 h-11 p-1 bg-muted">
            <TabsTrigger value="for-you" className="rounded-xl text-sm">
              <Sparkles className="h-3.5 w-3.5 mr-1.5" /> For you
            </TabsTrigger>
            <TabsTrigger value="tribe" className="rounded-xl text-sm">
              <Users className="h-3.5 w-3.5 mr-1.5" /> Tribe
            </TabsTrigger>
            <TabsTrigger value="nearby" className="rounded-xl text-sm">
              <MapPin className="h-3.5 w-3.5 mr-1.5" /> Nearby
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
                      onCta={() =>
                        hasPets
                          ? window.dispatchEvent(new CustomEvent("petos:open-composer"))
                          : nav("/onboarding")
                      }
                      secondaryLabel="Explore Discover"
                      onSecondary={() => nav("/discover")}
                    />
                  }
                />
              </Suspense>
            )}
          </TabsContent>

          <TabsContent value="tribe">
            {tab === "tribe" && (
              <Suspense fallback={<div className="h-72 rounded-2xl bg-muted/40 animate-pulse" />}>
                <PostFeed
                  scope="tribe"
                  emptyState={
                    <EmptyState
                      icon={Users}
                      title="Your tribe is quiet today"
                      description={
                        hasPets
                          ? `We surface posts from pets that share ${pets![0].name}'s breed or city. Add more details to your pet to widen the tribe.`
                          : "Add a pet so we can find your tribe — same breed, same city, same vibe."
                      }
                      ctaLabel={hasPets ? "Edit pet details" : "Add a pet"}
                      onCta={() => nav(hasPets ? `/settings/pet/${pets![0].id}` : "/onboarding")}
                      secondaryLabel="Find people"
                      onSecondary={() => nav("/discover")}
                    />
                  }
                />
              </Suspense>
            )}
          </TabsContent>

          <TabsContent value="nearby">
            {tab === "nearby" && (
              <Suspense fallback={<div className="h-72 rounded-2xl bg-muted/40 animate-pulse" />}>
                <PostFeed
                  scope="nearby"
                  emptyState={
                    <EmptyState
                      icon={MapPin}
                      title={cityKnown ? "Quiet in your city today" : "Tell us your city"}
                      description={
                        cityKnown
                          ? `Posts from pets in ${profile?.city} appear here. Be the first today — share a moment.`
                          : "Add your city in Settings so we can show pets and moments around you."
                      }
                      ctaLabel={cityKnown ? "Share a moment" : "Set my city"}
                      onCta={() =>
                        cityKnown
                          ? window.dispatchEvent(new CustomEvent("petos:open-composer"))
                          : nav("/settings/about")
                      }
                      secondaryLabel="Discover nearby"
                      onSecondary={() => nav("/discover")}
                    />
                  }
                />
              </Suspense>
            )}
          </TabsContent>
        </Tabs>
      </section>

      <TodayPanel open={todayOpen} onOpenChange={setTodayOpen} />
    </div>
  );
};

export default PetParentHome;
