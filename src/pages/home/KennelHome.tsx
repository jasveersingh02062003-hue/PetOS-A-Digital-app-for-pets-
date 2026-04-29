import { lazy, Suspense } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Heart, Building2, Calendar, Plus, BedDouble, Loader2 } from "lucide-react";
import { useSeo } from "@/hooks/useSeo";
import { SellerBadge } from "@/components/SellerBadge";
import { KpiCard } from "./dashboard/KpiCard";
import { PostFeed } from "@/components/PostFeed";
import { EmptyState } from "@/components/EmptyState";
import { format, formatDistanceToNow } from "date-fns";

const StoryRail = lazy(() =>
  import("@/components/social/StoryRail").then((m) => ({ default: m.StoryRail })),
);

/**
 * Real-data kennel dashboard.
 *
 * Live queries:
 *  - Today's bookings: service_bookings via service_providers owned by me (status confirmed/pending), scheduled today
 *  - Active services: boarding_services where owner_id=me AND active
 *  - Pending bookings (for KPI)
 */
const KennelHome = () => {
  const nav = useNavigate();
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const uid = user?.id;
  const firstName = profile?.full_name?.split(" ")[0];

  useSeo({ title: "Kennel hub", description: "Bookings, services and check-ins.", noIndex: true });

  // Get my provider ids first (needed for service_bookings join)
  const providerIds = useQuery({
    queryKey: ["kennel-providers", uid],
    enabled: !!uid,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_providers")
        .select("id")
        .eq("owner_id", uid!);
      if (error) throw error;
      return (data ?? []).map((r) => r.id as string);
    },
  });
  const ids = providerIds.data ?? [];

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const todayBookings = useQuery({
    queryKey: ["kennel-bookings-today", uid, ids],
    enabled: !!uid && ids.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_bookings")
        .select("id, scheduled_at, status, customer_id, pet_id, notes")
        .in("provider_id", ids)
        .gte("scheduled_at", todayStart.toISOString())
        .lte("scheduled_at", todayEnd.toISOString())
        .order("scheduled_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const pendingBookings = useQuery({
    queryKey: ["kennel-bookings-pending", uid, ids],
    enabled: !!uid && ids.length > 0,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("service_bookings")
        .select("id", { count: "exact", head: true })
        .in("provider_id", ids)
        .eq("status", "pending");
      if (error) throw error;
      return count ?? 0;
    },
  });

  const services = useQuery({
    queryKey: ["kennel-services", uid],
    enabled: !!uid,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("boarding_services")
        .select("id", { count: "exact", head: true })
        .eq("owner_id", uid!)
        .eq("active", true);
      if (error) throw error;
      return count ?? 0;
    },
  });

  const tint = "bg-sky/10";

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
          <SellerBadge type="kennel" />
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3">
        <KpiCard
          label="Today's bookings"
          value={todayBookings.data?.length ?? 0}
          loading={todayBookings.isLoading}
          icon={Calendar}
          to="/bookings/recurring"
          tint={tint}
        />
        <KpiCard
          label="Pending"
          value={pendingBookings.data}
          sub="awaiting confirm"
          loading={pendingBookings.isLoading}
          icon={BedDouble}
          to="/bookings/recurring"
          tint={tint}
        />
        <KpiCard
          label="Active services"
          value={services.data}
          loading={services.isLoading}
          icon={Building2}
          to="/services"
          tint={tint}
        />
        <KpiCard
          label="Daily report"
          value="Open"
          icon={Plus}
          to="/services"
          tint="bg-primary/5"
        />
      </div>

      <div className="flex flex-wrap gap-2 mt-4">
        <Button size="sm" onClick={() => nav("/services")} className="rounded-full">
          <Plus className="h-3.5 w-3.5 mr-1.5" /> New service slot
        </Button>
        <Button size="sm" variant="outline" onClick={() => nav("/bookings/recurring")} className="rounded-full">
          View bookings
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
          <div className="text-sm font-semibold">Today's check-ins</div>
          <Link to="/bookings/recurring" className="text-xs font-medium text-primary hover:underline">
            View all
          </Link>
        </div>
        {todayBookings.isLoading ? (
          <div className="py-6 grid place-items-center">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : !todayBookings.data?.length ? (
          <p className="text-sm text-muted-foreground py-4">No bookings today.</p>
        ) : (
          <ul className="divide-y divide-hairline">
            {todayBookings.data.slice(0, 5).map((b) => (
              <li key={b.id} className="py-2 flex items-center gap-3">
                <Calendar className="h-4 w-4 text-sky shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm truncate">{b.notes ?? "Booking"}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {format(new Date(b.scheduled_at), "h:mm a")} · {b.status}
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
              description="Share boarding photos, promotions or daily reports."
              ctaLabel="Share a moment"
              onCta={() => window.dispatchEvent(new CustomEvent("petos:open-composer"))}
            />
          }
        />
      </section>
    </div>
  );
};

export default KennelHome;
