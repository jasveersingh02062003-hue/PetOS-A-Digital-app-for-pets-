import { useNavigate } from "react-router-dom";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PostFeed } from "@/components/PostFeed";
import { MatesGrid } from "@/components/MatesGrid";
import { SearchBar } from "@/components/SearchBar";
import { EmptyState } from "@/components/EmptyState";
import { LocalPackRail } from "@/components/social/LocalPackRail";
import { TrendingHashtagsRail } from "@/components/social/TrendingHashtagsRail";
import { Compass, Flame, Users, CalendarDays, Stethoscope } from "lucide-react";

const Discover = () => {
  const nav = useNavigate();
  return (
    <div className="container-app pad-top-safe">
      <header className="pt-6 pb-4">
        <h1 className="font-display text-3xl">Discover</h1>
        <p className="text-sm text-muted-foreground mt-1">Pets, mates and stories from your city.</p>
      </header>
      <div className="mb-5">
        <SearchBar />
      </div>

      <TrendingHashtagsRail />

      <LocalPackRail />

      <div className="grid grid-cols-3 gap-3 mb-5">
        <button onClick={() => nav("/groups")} className="rounded-2xl border border-border bg-card p-3 text-left hover:border-primary/40 transition-colors">
          <Users className="h-5 w-5 text-primary mb-2" />
          <div className="font-display text-sm">Groups</div>
          <div className="text-[10px] text-muted-foreground">Breed · city</div>
        </button>
        <button onClick={() => nav("/meetups")} className="rounded-2xl border border-border bg-card p-3 text-left hover:border-primary/40 transition-colors">
          <CalendarDays className="h-5 w-5 text-primary mb-2" />
          <div className="font-display text-sm">Meetups</div>
          <div className="text-[10px] text-muted-foreground">Playdates</div>
        </button>
        <button onClick={() => nav("/askvet")} className="rounded-2xl border border-border bg-card p-3 text-left hover:border-primary/40 transition-colors">
          <Stethoscope className="h-5 w-5 text-primary mb-2" />
          <div className="font-display text-sm">AskVet</div>
          <div className="text-[10px] text-muted-foreground">Verified Q&amp;A</div>
        </button>
      </div>

      <Tabs defaultValue="trending" className="w-full">
        <TabsList className="grid grid-cols-4 w-full bg-muted rounded-xl mb-5">
          <TabsTrigger value="trending" className="rounded-lg">Trending</TabsTrigger>
          <TabsTrigger value="latest" className="rounded-lg">Latest</TabsTrigger>
          <TabsTrigger value="nearby" className="rounded-lg">Near me</TabsTrigger>
          <TabsTrigger value="mates" className="rounded-lg">Mates</TabsTrigger>
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

        <TabsContent value="nearby" className="pb-10">
          <NearMePanel />
        </TabsContent>

        <TabsContent value="mates" className="pb-10">
          <MatesGrid />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Discover;
