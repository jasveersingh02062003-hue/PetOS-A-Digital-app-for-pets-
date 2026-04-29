import { lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import { useProfile } from "@/hooks/useProfile";
import { PostFeed } from "@/components/PostFeed";
import { EmptyState } from "@/components/EmptyState";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Heart, Plus } from "lucide-react";
import { useSeo } from "@/hooks/useSeo";
import { QuickAccessRail } from "@/components/QuickAccessRail";
import { SellerBadge } from "@/components/SellerBadge";
import { getRoleBanner } from "@/lib/roleTheme";

const StoryRail = lazy(() =>
  import("@/components/social/StoryRail").then((m) => ({ default: m.StoryRail })),
);

type RoleConfig = {
  hero: string;
  blurb: string;
  primaryCta: { label: string; to: string };
  secondaryCta?: { label: string; to: string };
};

const CONFIG: Record<string, RoleConfig> = {
  breeder: {
    hero: "Active litters & mating requests",
    blurb: "Manage litters, mating availability and enquiries.",
    primaryCta: { label: "New litter", to: "/breeders" },
    secondaryCta: { label: "Mating board", to: "/mates" },
  },
  kennel: {
    hero: "Today's bookings",
    blurb: "Boarding bookings, services and daily reports.",
    primaryCta: { label: "New service slot", to: "/services" },
    secondaryCta: { label: "View bookings", to: "/bookings/recurring" },
  },
  shelter: {
    hero: "Adoptable animals & open applications",
    blurb: "List adoptables, review applications and post missing pets.",
    primaryCta: { label: "List for adoption", to: "/mates/adopt/new" },
    secondaryCta: { label: "Post missing", to: "/missing" },
  },
  rescuer: {
    hero: "Open rescue cases",
    blurb: "Coordinate rescues, post urgent cases and updates.",
    primaryCta: { label: "Urgent case", to: "/missing" },
    secondaryCta: { label: "Adoptables", to: "/mates" },
  },
  sanctuary: {
    hero: "Animals in care",
    blurb: "Add animals in care, post updates and accept donations.",
    primaryCta: { label: "Add animal", to: "/mates/adopt/new" },
    secondaryCta: { label: "Donations", to: "/org/donations" },
  },
  zoo: {
    hero: "Today's exhibits & events",
    blurb: "Educational posts, exhibits and visitor announcements.",
    primaryCta: { label: "Educational post", to: "/discover" },
  },
  buyer: {
    hero: "Saved searches & new matches",
    blurb: "Browse adoptables, breeders nearby and post a wanted listing.",
    primaryCta: { label: "Browse adopt", to: "/mates" },
    secondaryCta: { label: "Browse breeders", to: "/breeders" },
  },
};

/**
 * Generic role-aware Home scaffold.
 * Used as the landing dashboard for non-pet-parent roles until each role's
 * bespoke dashboard ships. Always shows: role banner, KPI placeholder, quick
 * actions, story rail, social feed.
 */
const RoleHome = ({ accountType }: { accountType: string }) => {
  const nav = useNavigate();
  const { data: profile } = useProfile();
  const cfg = CONFIG[accountType] ?? CONFIG.buyer;
  const firstName = profile?.full_name?.split(" ")[0];

  useSeo({ title: "Home", description: cfg.blurb, noIndex: true });

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
          <SellerBadge type={accountType as any} />
        </div>
      </header>

      {/* Role-tinted hero KPI card */}
      <Card className={`rounded-2xl border-hairline shadow-none p-5 ${getRoleBanner(accountType)}`}>
        <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground font-semibold">
          {cfg.hero}
        </div>
        <p className="text-sm text-muted-foreground mt-2">{cfg.blurb}</p>
        <div className="flex flex-wrap gap-2 mt-4">
          <Button
            size="sm"
            onClick={() => nav(cfg.primaryCta.to)}
            className="rounded-full"
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" /> {cfg.primaryCta.label}
          </Button>
          {cfg.secondaryCta && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => nav(cfg.secondaryCta!.to)}
              className="rounded-full"
            >
              {cfg.secondaryCta.label}
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => window.dispatchEvent(new CustomEvent("petos:open-composer"))}
            className="rounded-full"
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" /> Post photo
          </Button>
        </div>
      </Card>

      <Suspense fallback={<div className="h-[88px]" />}>
        <StoryRail />
      </Suspense>

      <QuickAccessRail />

      <section className="pb-10 mt-4">
        <PostFeed
          scope="all"
          emptyState={
            <EmptyState
              icon={Heart}
              title="Your feed will appear here"
              description="Share an update, photo or story to get the community going."
              ctaLabel="Share a moment"
              onCta={() => window.dispatchEvent(new CustomEvent("petos:open-composer"))}
              secondaryLabel="Explore Discover"
              onSecondary={() => nav("/discover")}
            />
          }
        />
      </section>
    </div>
  );
};

export default RoleHome;
