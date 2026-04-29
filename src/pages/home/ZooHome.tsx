import { lazy, Suspense, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Heart, ShieldAlert, CalendarDays, Plus, BookOpen, Loader2, Eye } from "lucide-react";
import { useSeo } from "@/hooks/useSeo";
import { SellerBadge } from "@/components/SellerBadge";
import { KpiCard } from "./dashboard/KpiCard";
import { PostFeed } from "@/components/PostFeed";
import { EmptyState } from "@/components/EmptyState";
import { format } from "date-fns";
import { ExhibitSheet } from "@/components/zoo/ExhibitSheet";

const StoryRail = lazy(() =>
  import("@/components/social/StoryRail").then((m) => ({ default: m.StoryRail })),
);

/**
 * Real-data zoo / wildlife dashboard.
 *
 * Live queries:
 *  - Pets registered by me (proxy for animals on display)
 *  - Upcoming meetups hosted by me (events)
 *  - Posts authored by me (educational posts proxy)
 */
const ZooHome = () => {
  const nav = useNavigate();
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const uid = user?.id;
  const firstName = profile?.full_name?.split(" ")[0];
  const [exhibitOpen, setExhibitOpen] = useState(false);

  useSeo({ title: "Zoo hub", description: "Exhibits, events and educational content.", noIndex: true });

  const exhibits = useQuery({
    queryKey: ["zoo-exhibits", uid],
    enabled: !!uid,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exhibits")
        .select("id, name, species, habitat, on_display, created_at")
        .eq("zoo_user_id", uid!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  const onDisplayCount = exhibits.data?.filter((e) => e.on_display).length ?? 0;

  const upcomingEvents = useQuery({
    queryKey: ["zoo-events", uid],
    enabled: !!uid,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meetups")
        .select("id, title, starts_at, city, attending_count")
        .eq("host_id", uid!)
        .eq("status", "upcoming")
        .gte("starts_at", new Date().toISOString())
        .order("starts_at", { ascending: true })
        .limit(5);
      if (error) throw error;
      return data ?? [];
    },
  });

  const myPosts = useQuery({
    queryKey: ["zoo-posts", uid],
    enabled: !!uid,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("posts")
        .select("id", { count: "exact", head: true })
        .eq("author_id", uid!);
      if (error) throw error;
      return count ?? 0;
    },
  });

  const tint = "bg-stone-500/10";

  return (
    <div className="container-app pad-top-safe">
      <header className="pt-6 pb-4">
        <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">
          {new Date().toLocaleDateString(undefined, { weekday: "long" })}
        </div>
        <div className="flex items-center justify-between gap-3 mt-1">
          <h1 className="font-display text-[28px] leading-tight">
            {firstName ? <>Hi, <span className="text-primary">{firstName}</span></> : "Welcome"}
          </h1>
          <SellerBadge type="zoo" />
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3">
        <KpiCard
          label="Animals on display"
          value={animals.data}
          loading={animals.isLoading}
          icon={ShieldAlert}
          tint={tint}
        />
        <KpiCard
          label="Upcoming events"
          value={upcomingEvents.data?.length ?? 0}
          loading={upcomingEvents.isLoading}
          icon={CalendarDays}
          to="/discover"
          tint={tint}
        />
        <KpiCard
          label="Posts"
          value={myPosts.data}
          sub="published"
          loading={myPosts.isLoading}
          icon={BookOpen}
          tint="bg-primary/5"
        />
        <KpiCard label="Educate" value="Share" icon={Plus} tint="bg-primary/5" />
      </div>

      <div className="flex flex-wrap gap-2 mt-4">
        <Button
          size="sm"
          onClick={() => window.dispatchEvent(new CustomEvent("petos:open-composer"))}
          className="rounded-full"
        >
          <Plus className="h-3.5 w-3.5 mr-1.5" /> Educational post
        </Button>
        <Button size="sm" variant="outline" onClick={() => nav("/discover")} className="rounded-full">
          Events
        </Button>
      </div>

      <Card className="rounded-2xl border-hairline shadow-none p-4 mt-4">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-semibold">Upcoming events</div>
          <Link to="/discover" className="text-xs font-medium text-primary hover:underline">
            View all
          </Link>
        </div>
        {upcomingEvents.isLoading ? (
          <div className="py-6 grid place-items-center">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : !upcomingEvents.data?.length ? (
          <p className="text-sm text-muted-foreground py-4">No upcoming events.</p>
        ) : (
          <ul className="divide-y divide-hairline">
            {upcomingEvents.data.map((m: any) => (
              <li key={m.id} className="py-2 flex items-center gap-3">
                <CalendarDays className="h-4 w-4 text-stone-600 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm truncate">{m.title}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {format(new Date(m.starts_at), "EEE, MMM d · h:mm a")}
                    {m.city ? ` · ${m.city}` : ""} · {m.attending_count} attending
                  </div>
                </div>
                <Link
                  to={`/meetups/${m.id}`}
                  className="text-xs font-medium text-primary hover:underline shrink-0"
                >
                  Open
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Suspense fallback={<div className="h-[88px]" />}>
        <StoryRail />
      </Suspense>

      <section className="pb-10 mt-4">
        <PostFeed
          scope="all"
          emptyState={
            <EmptyState
              icon={Heart}
              title="Your feed will appear here"
              description="Share educational content and exhibit updates."
              ctaLabel="Share a moment"
              onCta={() => window.dispatchEvent(new CustomEvent("petos:open-composer"))}
            />
          }
        />
      </section>
    </div>
  );
};

export default ZooHome;
