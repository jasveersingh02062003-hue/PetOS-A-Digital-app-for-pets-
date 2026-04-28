import { useNavigate } from "react-router-dom";
import { useProfile, usePets } from "@/hooks/useProfile";
import { ComposerButton } from "@/components/Composer";
import { PostFeed } from "@/components/PostFeed";
import { MissingStrip } from "@/components/MissingStrip";
import { DailyTipCard } from "@/components/DailyTipCard";
import { EmptyState } from "@/components/EmptyState";
import { StoryRail } from "@/components/social/StoryRail";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Heart, Users } from "lucide-react";

const Home = () => {
  const nav = useNavigate();
  const { data: profile } = useProfile();
  const { data: pets } = usePets();
  const firstName = profile?.full_name?.split(" ")[0];
  const hasPets = !!pets && pets.length > 0;

  return (
    <div className="container-app pad-top-safe">
      <header className="pt-6 pb-4 flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">{new Date().toLocaleDateString(undefined, { weekday: "long" })}</div>
          <h1 className="font-display text-3xl mt-1">Hello{firstName ? `, ${firstName}` : ""}</h1>
        </div>
        <ComposerButton variant="icon" />
      </header>

      <StoryRail />

      <div className="mt-2 mb-3">
        <MissingStrip />
      </div>

      <div className="mt-2 mb-4">
        <DailyTipCard />
      </div>

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
    </div>
  );
};

export default Home;

