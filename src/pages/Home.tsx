import { useNavigate } from "react-router-dom";
import { useProfile, usePets } from "@/hooks/useProfile";
import { ComposerButton } from "@/components/Composer";
import { PostFeed } from "@/components/PostFeed";
import { MissingStrip } from "@/components/MissingStrip";
import { DailyTipCard } from "@/components/DailyTipCard";
import { EmptyState } from "@/components/EmptyState";
import { StoryRail } from "@/components/social/StoryRail";
import { DailyPromptBanner } from "@/components/social/DailyPromptBanner";
import { MeetupCard } from "@/components/social/MeetupCard";
import { HealthStatusStrip } from "@/components/health/HealthStatusStrip";
import { PharmacySuggestionsBanner } from "@/components/health/PharmacySuggestionsBanner";
import { useUpcomingMeetups } from "@/hooks/useMeetups";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Heart, Users, CalendarDays } from "lucide-react";
import { useSeo } from "@/hooks/useSeo";
import { HomeHero } from "@/components/HomeHero";
import { QuickAccessRail } from "@/components/QuickAccessRail";

const Home = () => {
  const nav = useNavigate();
  const { data: profile } = useProfile();
  const { data: pets } = usePets();
  const { data: nextMeetups } = useUpcomingMeetups(profile?.city);
  const firstName = profile?.full_name?.split(" ")[0];
  const hasPets = !!pets && pets.length > 0;
  const upcoming = (nextMeetups ?? []).slice(0, 1);

  useSeo({ title: "Home", description: "Your daily Petos feed: stories, meetups, health and missing-pet alerts.", noIndex: true });


  return (
    <div className="container-app pad-top-safe">
      <header className="pt-6 pb-4 flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">{new Date().toLocaleDateString(undefined, { weekday: "long" })}</div>
          <h1 className="font-display text-3xl mt-1">Hello{firstName ? `, ${firstName}` : ""}</h1>
        </div>
        <ComposerButton variant="icon" />
      </header>

      <HomeHero />

      <QuickAccessRail />

      {hasPets && <HealthStatusStrip petId={pets![0].id} />}
      <PharmacySuggestionsBanner />

      <StoryRail />

      <div className="-mx-4 mt-2"><DailyPromptBanner /></div>

      <div className="mt-2 mb-3">
        <MissingStrip />
      </div>

      <div className="mt-2 mb-4">
        <DailyTipCard />
      </div>

      {upcoming.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-display text-base flex items-center gap-1.5">
              <CalendarDays className="h-4 w-4 text-primary" /> Upcoming meetup
            </h2>
            <button onClick={() => nav("/meetups")} className="text-xs text-muted-foreground">See all</button>
          </div>
          <MeetupCard meetup={upcoming[0]} />
        </div>
      )}

      <div className="mt-3 mb-4">
        <ComposerButton variant="inline" />
      </div>

      <section className="pb-10">
        <Tabs defaultValue="for-you">
          <TabsList className="grid grid-cols-2 w-full rounded-xl mb-3">
            <TabsTrigger value="for-you">For you</TabsTrigger>
            <TabsTrigger value="following"><Users className="h-3.5 w-3.5 mr-1.5" /> Following</TabsTrigger>
          </TabsList>
          <TabsContent value="for-you">
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
                  onCta={() => nav(hasPets ? "/" : "/onboarding")}
                  secondaryLabel="Explore Discover"
                  onSecondary={() => nav("/discover")}
                />
              }
            />
          </TabsContent>
          <TabsContent value="following">
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
          </TabsContent>
        </Tabs>
      </section>

      <ComposerButton variant="fab" />
      <ComposerButton variant="global" />
    </div>
  );
};

export default Home;

