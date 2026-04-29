import { lazy, Suspense } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Heart, ShieldHalf, Plus, IndianRupee, Loader2 } from "lucide-react";
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
 * Real-data sanctuary / gaushala dashboard.
 *
 * Live queries:
 *  - Animals in care: pet_listings owned by me where listing_type='adoption' AND active (proxy for "in care available for sponsorship/adoption")
 *  - Donations this month: SUM(amount_inr) where org_user_id=me, status='paid', paid_at >= start of month
 *  - Recent donors: latest 3 paid donations
 *
 * Per Phase 0 default: Animals in care is the hero KPI; donations second.
 */
const GaushalaHome = () => {
  const nav = useNavigate();
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const uid = user?.id;
  const firstName = profile?.full_name?.split(" ")[0];

  useSeo({ title: "Gaushala hub", description: "Animals in care, donations and updates.", noIndex: true });

  const animals = useQuery({
    queryKey: ["gaushala-animals", uid],
    enabled: !!uid,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("pet_listings")
        .select("id", { count: "exact", head: true })
        .eq("owner_id", uid!)
        .eq("active", true);
      if (error) throw error;
      return count ?? 0;
    },
  });

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const donations = useQuery({
    queryKey: ["gaushala-donations-month", uid],
    enabled: !!uid,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("donations")
        .select("amount_inr")
        .eq("org_user_id", uid!)
        .eq("status", "paid")
        .gte("paid_at", monthStart.toISOString());
      if (error) throw error;
      return (data ?? []).reduce((s, d: any) => s + (d.amount_inr ?? 0), 0);
    },
  });

  const recentDonors = useQuery({
    queryKey: ["gaushala-donors-recent", uid],
    enabled: !!uid,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("donations")
        .select("id, amount_inr, message, anonymous, donor_id, paid_at, created_at")
        .eq("org_user_id", uid!)
        .eq("status", "paid")
        .order("paid_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data ?? [];
    },
  });

  const tint = "bg-leaf/10";

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
          <SellerBadge type="sanctuary" />
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3">
        <KpiCard
          label="Animals in care"
          value={animals.data}
          loading={animals.isLoading}
          icon={ShieldHalf}
          to="/mates"
          tint={tint}
        />
        <KpiCard
          label="Donations (month)"
          value={donations.data != null ? `₹${donations.data.toLocaleString("en-IN")}` : 0}
          loading={donations.isLoading}
          icon={IndianRupee}
          to="/org/donations"
          tint={tint}
        />
        <KpiCard
          label="Sponsorships"
          value={recentDonors.data?.length ?? 0}
          sub="recent supporters"
          loading={recentDonors.isLoading}
          icon={Heart}
          to="/org/donations"
          tint="bg-coral/10"
        />
        <KpiCard
          label="Post update"
          value="Share"
          icon={Plus}
          tint="bg-primary/5"
        />
      </div>

      <div className="flex flex-wrap gap-2 mt-4">
        <Button size="sm" onClick={() => nav("/mates/adopt/new")} className="rounded-full">
          <Plus className="h-3.5 w-3.5 mr-1.5" /> Add animal
        </Button>
        <Button size="sm" variant="outline" onClick={() => nav("/org/donations")} className="rounded-full">
          Donations
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => window.dispatchEvent(new CustomEvent("petos:open-composer"))}
          className="rounded-full"
        >
          <Plus className="h-3.5 w-3.5 mr-1.5" /> Post update
        </Button>
      </div>

      <Card className="rounded-2xl border-hairline shadow-none p-4 mt-4">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-semibold">Recent donors</div>
          <Link to="/org/donations" className="text-xs font-medium text-primary hover:underline">
            View all
          </Link>
        </div>
        {recentDonors.isLoading ? (
          <div className="py-6 grid place-items-center">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : !recentDonors.data?.length ? (
          <p className="text-sm text-muted-foreground py-4">No donations yet.</p>
        ) : (
          <ul className="divide-y divide-hairline">
            {recentDonors.data.map((d: any) => (
              <li key={d.id} className="py-2 flex items-center gap-3">
                <Heart className="h-4 w-4 text-coral shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm truncate">
                    ₹{d.amount_inr.toLocaleString("en-IN")} {d.message ? `· ${d.message}` : ""}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {d.anonymous ? "Anonymous" : "Donor"} ·{" "}
                    {formatDistanceToNow(new Date(d.paid_at ?? d.created_at), { addSuffix: true })}
                  </div>
                </div>
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
              description="Share rescue updates and animal stories with your supporters."
              ctaLabel="Share a moment"
              onCta={() => window.dispatchEvent(new CustomEvent("petos:open-composer"))}
            />
          }
        />
      </section>
    </div>
  );
};

export default GaushalaHome;
