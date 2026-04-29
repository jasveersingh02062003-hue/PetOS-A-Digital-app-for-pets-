import { lazy, Suspense, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Heart, PawPrint, Sparkles, Inbox, Plus, Loader2, ScrollText, BadgeCheck } from "lucide-react";
import { useSeo } from "@/hooks/useSeo";
import { SellerBadge } from "@/components/SellerBadge";
import { KpiCard } from "./dashboard/KpiCard";
import { PostFeed } from "@/components/PostFeed";
import { EmptyState } from "@/components/EmptyState";
import { formatDistanceToNow } from "date-fns";
import { PedigreeSheet } from "@/components/breeder/PedigreeSheet";

const StoryRail = lazy(() =>
  import("@/components/social/StoryRail").then((m) => ({ default: m.StoryRail })),
);

/**
 * Real-data breeder dashboard.
 *
 * Live queries:
 *  - Active litters: litter_groups created by me
 *  - Pending mating requests TO me: mating_requests where to_owner_id = me, status = 'pending'
 *  - Active mating listings: mating_listings where owner_id = me, active
 *
 * Inbox preview: latest 3 pending requests with sender + pet name.
 */
const BreederHome = () => {
  const nav = useNavigate();
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const uid = user?.id;
  const firstName = profile?.full_name?.split(" ")[0];
  const [pedigreeOpen, setPedigreeOpen] = useState(false);

  useSeo({ title: "Breeder hub", description: "Litters, mating requests and enquiries.", noIndex: true });

  const litters = useQuery({
    queryKey: ["breeder-litters", uid],
    enabled: !!uid,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("litter_groups")
        .select("id", { count: "exact", head: true })
        .eq("created_by", uid!);
      if (error) throw error;
      return count ?? 0;
    },
  });

  const pendingRequests = useQuery({
    queryKey: ["breeder-mating-pending", uid],
    enabled: !!uid,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("mating_requests")
        .select("id", { count: "exact", head: true })
        .eq("to_owner_id", uid!)
        .eq("status", "pending");
      if (error) throw error;
      return count ?? 0;
    },
  });

  const activeListings = useQuery({
    queryKey: ["breeder-mating-listings", uid],
    enabled: !!uid,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("mating_listings")
        .select("id", { count: "exact", head: true })
        .eq("owner_id", uid!)
        .eq("active", true);
      if (error) throw error;
      return count ?? 0;
    },
  });

  const inbox = useQuery({
    queryKey: ["breeder-mating-inbox", uid],
    enabled: !!uid,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mating_requests")
        .select("id, message, status, created_at, from_owner_id, from_pet_id, to_pet_id")
        .eq("to_owner_id", uid!)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(3);
      if (error) throw error;
      return data ?? [];
    },
  });

  const certificates = useQuery({
    queryKey: ["breeder-certificates", uid],
    enabled: !!uid,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pedigree_certificates")
        .select("id, certificate_number, breed, registry_name, issued_at, pet_id, pets(name)")
        .eq("issued_by", uid!)
        .order("issued_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data ?? [];
    },
  });

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
          <SellerBadge type="breeder" />
        </div>
      </header>

      {/* KPI grid — every value is a real count */}
      <div className="grid grid-cols-2 gap-3">
        <KpiCard
          label="Active litters"
          value={litters.data}
          loading={litters.isLoading}
          icon={PawPrint}
          to="/breeders"
          tint="bg-amber-500/10"
        />
        <KpiCard
          label="Mating requests"
          value={pendingRequests.data}
          sub="pending"
          loading={pendingRequests.isLoading}
          icon={Inbox}
          to="/mates"
          tint="bg-amber-500/10"
        />
        <KpiCard
          label="Mating listings"
          value={activeListings.data}
          sub="active"
          loading={activeListings.isLoading}
          icon={Sparkles}
          to="/mates"
          tint="bg-amber-500/10"
        />
        <KpiCard
          label="Pedigree certs"
          value={certificates.data?.length ?? 0}
          sub="issued"
          loading={certificates.isLoading}
          icon={ScrollText}
          tint="bg-amber-500/10"
        />
      </div>

      <div className="flex flex-wrap gap-2 mt-4">
        <Button size="sm" onClick={() => nav("/breeders")} className="rounded-full">
          <Plus className="h-3.5 w-3.5 mr-1.5" /> New litter
        </Button>
        <Button size="sm" variant="outline" onClick={() => setPedigreeOpen(true)} className="rounded-full">
          <ScrollText className="h-3.5 w-3.5 mr-1.5" /> Verify lineage
        </Button>
        <Button size="sm" variant="outline" onClick={() => nav("/mates")} className="rounded-full">
          Mating board
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
          <div className="text-sm font-semibold">Pedigree certificates</div>
          <button
            onClick={() => setPedigreeOpen(true)}
            className="text-xs font-medium text-primary hover:underline"
          >
            Issue
          </button>
        </div>
        {certificates.isLoading ? (
          <div className="py-6 grid place-items-center">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : !certificates.data?.length ? (
          <p className="text-sm text-muted-foreground py-4">
            No certificates yet. Issue one to verify a pet's lineage.
          </p>
        ) : (
          <ul className="divide-y divide-hairline">
            {certificates.data.map((c: any) => (
              <li key={c.id} className="py-2 flex items-center gap-3">
                <BadgeCheck className="h-4 w-4 text-amber-600 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm truncate">
                    {c.pets?.name ?? "Pet"} · {c.breed ?? "—"}
                  </div>
                  <div className="text-[11px] text-muted-foreground truncate">
                    {c.certificate_number}
                    {c.registry_name ? ` · ${c.registry_name}` : ""}
                  </div>
                </div>
                <span className="text-[10px] text-muted-foreground shrink-0">
                  {formatDistanceToNow(new Date(c.issued_at), { addSuffix: true })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Mating requests inbox preview */}
      <Card className="rounded-2xl border-hairline shadow-none p-4 mt-4">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-semibold">Mating requests inbox</div>
          <Link to="/mates" className="text-xs font-medium text-primary hover:underline">
            View all
          </Link>
        </div>
        {inbox.isLoading ? (
          <div className="py-6 grid place-items-center">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : !inbox.data?.length ? (
          <p className="text-sm text-muted-foreground py-4">
            No pending mating requests yet.
          </p>
        ) : (
          <ul className="divide-y divide-hairline">
            {inbox.data.map((r) => (
              <li key={r.id} className="py-2 flex items-center gap-3">
                <Heart className="h-4 w-4 text-amber-600 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm truncate">{r.message ?? "New mating request"}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                  </div>
                </div>
                <Link
                  to="/mates"
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
              description="Share litter photos, kennel updates or community moments."
              ctaLabel="Share a moment"
              onCta={() => window.dispatchEvent(new CustomEvent("petos:open-composer"))}
            />
          }
        />
      </section>
      <PedigreeSheet open={pedigreeOpen} onOpenChange={setPedigreeOpen} />
    </div>
  );
};

export default BreederHome;
