import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { PetHeroCard } from "@/components/home/PetHeroCard";
import { HealthSetupReminder } from "@/components/health/HealthSetupReminder";
import { EmergencyButton } from "@/components/home/EmergencyButton";
import { lazy, Suspense } from "react";
import { useProfile } from "@/hooks/useProfile";

const QuickAccessRail = lazy(() =>
  import("@/components/QuickAccessRail").then((m) => ({ default: m.QuickAccessRail })),
);
const ProactiveAlertsCard = lazy(() =>
  import("@/components/home/ProactiveAlertsCard").then((m) => ({ default: m.ProactiveAlertsCard })),
);
const BookingSuggestionsCard = lazy(() =>
  import("@/components/home/BookingSuggestionsCard").then((m) => ({ default: m.BookingSuggestionsCard })),
);

/**
 * The "Today" panel — a swipe-down/avatar-tap sheet that holds everything
 * we removed from the always-visible Home scroll path:
 *
 *   - Greeting ("Hi, X")
 *   - Pet hero card with quick CTAs (Moment / Health / Mates)
 *   - Health setup reminder
 *   - Emergency SOS ribbon
 *   - Proactive AI alerts + booking suggestions
 *   - The 6-icon quick-access grid
 *
 * Home itself is now feed-first (brand bar + story rail + tabs + vertical
 * feed). Operational stuff lives one tap away on the avatar.
 */
export const TodayPanel = ({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) => {
  const { data: profile } = useProfile();
  const firstName = profile?.full_name?.split(" ")[0];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="rounded-t-3xl max-h-[85vh] overflow-y-auto p-0"
      >
        <div className="container-app pt-6 pb-8">
          <SheetHeader className="text-left mb-4">
            <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">
              {new Date().toLocaleDateString(undefined, { weekday: "long" })}
            </div>
            <SheetTitle className="font-display text-[28px] mt-1 leading-tight">
              {firstName ? <>Hi, <span className="text-primary">{firstName}</span></> : "Welcome"}
            </SheetTitle>
          </SheetHeader>

          <PetHeroCard />
          <HealthSetupReminder variant="compact" />
          <EmergencyButton />

          <Suspense fallback={null}>
            <BookingSuggestionsCard />
            <ProactiveAlertsCard />
          </Suspense>

          <div className="mt-3">
            <Suspense fallback={<div className="h-20" />}>
              <QuickAccessRail />
            </Suspense>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default TodayPanel;
