import { lazy, Suspense } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Heart, Home as HomeIcon, Inbox, Plus, AlertTriangle, Loader2 } from "lucide-react";
import { useSeo } from "@/hooks/useSeo";
import { SellerBadge } from "@/components/SellerBadge";
import { KpiCard } from "./dashboard/KpiCard";
import { PostFeed } from "@/components/PostFeed";
import { EmptyState } from "@/components/EmptyState";
import { formatDistanceToNow } from "date-fns";

const StoryRail = lazy(() =>
  import("@/components/social/StoryRail").then((m) => ({ default: m.StoryRail })),
);

/**
 * Real-data shelter / rescuer dashboard.
 *
 * Live queries:
 *  - Adoptable listings owned by me (pet_listings, listing_type='adoption', active)
 *  - Pending adoption applications addressed to me (adoption_applications, shelter_id=me, status='pending')
 *  - Missing pet posts owned by me, status='active'
 *  - Inbox: latest 3 pending adoption applications
 */
const ShelterHome = ({ variant = "shelter" }: { variant?: "shelter" | "rescuer" }) => {
  const nav = useNavigate();
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const uid = user?.id;
  const firstName = profile?.full_name?.split(" ")[0];

  useSeo({
    title: variant === "rescuer" ? "Rescuer hub" : "Shelter hub",
    description: "Adoptables, applications and rescue cases.",
    noIndex: true,
  });

  const adoptables = useQuery({
    queryKey: ["shelter-adoptables", uid],
    enabled: !!uid,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("pet_listings")
        .select("id", { count: "exact", head: true })
        .eq("owner_id", uid!)
        .eq("listing_type", "adoption")
        .eq("active", true);
      if (error) throw error;
      return count ?? 0;
    },
  });

  const applications = useQuery({
    queryKey: ["shelter-applications", uid],
    enabled: !!uid,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("adoption_applications")
        .select("id", { count: "exact", head: true })
        .eq("shelter_id", uid!)
        .eq("status", "pending");
      if (error) throw error;
      return count ?? 0;
    },
  });

  const missing = useQuery({
    queryKey: ["shelter-missing", uid],
    enabled: !!uid,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("missing_pets")
        .select("id", { count: "exact", head: true })
        .eq("owner_id", uid!)
        .eq("status", "active");
      if (error) throw error;
      return count ?? 0;
    },
  });

  const inbox = useQuery({
    queryKey: ["shelter-applications-inbox", uid],
    enabled: !!uid,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("adoption_applications")
        .select("id, applicant_id, home_description, city, created_at, listing_id")
        .eq("shelter_id", uid!)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(3);
      if (error) throw error;
      return data ?? [];
    },
  });

  const tint = "bg-lilac/10";
  const badgeType = variant === "rescuer" ? "rescuer" : "shelter";

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
          <SellerBadge type={badgeType as any} />
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3">
        <KpiCard
          label="Adoptables"
          value={adoptables.data}
          sub="active listings"
          loading={adoptables.isLoading}
          icon={HomeIcon}
          to="/mates"
          tint={tint}
        />
        <KpiCard
          label="Applications"
          value={applications.data}
          sub="pending"
          loading={applications.isLoading}
          icon={Inbox}
          to="/adoption-inbox"
          tint={tint}
        />
        <KpiCard
          label="Missing cases"
          value={missing.data}
          sub="active"
          loading={missing.isLoading}
          icon={AlertTriangle}
          to="/missing"
          tint="bg-coral/10"
        />
        <KpiCard
          label="Donations"
          value="View"
          icon={Heart}
          to="/org/donations"
          tint="bg-leaf/10"
        />
      </div>

      <div className="flex flex-wrap gap-2 mt-4">
        <Button size="sm" onClick={() => nav("/mates/adopt/new")} className="rounded-full">
          <Plus className="h-3.5 w-3.5 mr-1.5" /> List for adoption
        </Button>
        <Button size="sm" variant="outline" onClick={() => nav("/missing")} className="rounded-full">
          Post missing
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => window.dispatchEvent(new CustomEvent("petos:open-composer"))}
          className="rounded-full"
        >
          <Plus className="h-3.5 w-3.5 mr-1.5" /> Post photo
        </Button>
      </div>

      <Card className="rounded-2xl border-hairline shadow-none p-4 mt-4">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-semibold">Adoption applications</div>
          <Link to="/adoption-inbox" className="text-xs font-medium text-primary hover:underline">
            View all
          </Link>
        </div>
        {inbox.isLoading ? (
          <div className="py-6 grid place-items-center">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : !inbox.data?.length ? (
          <p className="text-sm text-muted-foreground py-4">No pending applications yet.</p>
        ) : (
          <ul className="divide-y divide-hairline">
            {inbox.data.map((a) => (
              <li key={a.id} className="py-2 flex items-center gap-3">
                <Inbox className="h-4 w-4 text-lilac shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm truncate">
                    {a.home_description?.slice(0, 60) || "New application"}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {a.city ?? "—"} · {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
                  </div>
                </div>
                <Link to="/adoption-inbox" className="text-xs font-medium text-primary hover:underline shrink-0">
                  Review
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
              description="Share rescue stories, adoption updates or volunteer calls."
              ctaLabel="Share a moment"
              onCta={() => window.dispatchEvent(new CustomEvent("petos:open-composer"))}
            />
          }
        />
      </section>
    </div>
  );
};

export default ShelterHome;
