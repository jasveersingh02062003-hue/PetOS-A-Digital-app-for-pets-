import { NavLink, useLocation } from "react-router-dom";
import { Home, Compass, Heart, User, Siren, Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { haptic } from "@/lib/haptics";
import { prefetchRoute } from "@/lib/prefetchRoute";
import { useNotifications } from "@/hooks/useNotifications";

/**
 * Flat 5-tab bottom nav (Instagram-style information architecture):
 *   Home · Mates · Health · Discover · Profile
 *
 * No center cutout, no global "+". Creation is handled by a per-tab
 * contextual FAB rendered in AppShell (see ContextualFab.tsx).
 * Emergency long-press lives on the contextual FAB; the small Siren
 * button stays pinned top-right of the nav for instant access.
 */
type TabDef = {
  to: string;
  label: string;
  icon: any;
  tone?: "coral";
  badgeKey?: "notifications";
};

const tabs: TabDef[] = [
  { to: "/", label: "Home", icon: Home },
  { to: "/mates", label: "Mates", icon: Heart, tone: "coral" },
  { to: "/health", label: "Health", icon: Activity },
  { to: "/discover", label: "Discover", icon: Compass },
  { to: "/profile", label: "Profile", icon: User, badgeKey: "notifications" },
];

export const BottomNav = ({ onEmergency }: { onEmergency: () => void }) => {
  const loc = useLocation();
  const { unreadCount } = useNotifications();

  const hidden = ["/auth", "/onboarding", "/ai"].some((p) => loc.pathname.startsWith(p)) || loc.pathname.startsWith("/admin");
  if (hidden) return null;

  const badgeFor = (key?: TabDef["badgeKey"]) =>
    key === "notifications" ? unreadCount : 0;

  return (
    <>
      {/* Emergency button — repositioned to top-right of nav so it stops
          floating in the middle of feed content. */}
      <button
        onClick={onEmergency}
        aria-label="Emergency assistant"
        className="fixed right-4 z-50 bg-emergency text-emergency-foreground rounded-full h-11 w-11 flex items-center justify-center shadow-lg active:scale-95 transition-transform"
        style={{ bottom: `calc(5.25rem + env(safe-area-inset-bottom))` }}
      >
        <Siren className="h-5 w-5" strokeWidth={2} />
      </button>

      <nav
        className="fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-xl border-t border-hairline"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="mx-auto max-w-[480px] grid grid-cols-5 h-[4.5rem] items-end pb-2">
          {tabs.map((t) => {
            const Icon = t.icon;
            const badge = badgeFor(t.badgeKey);
            return (
              <NavLink
                key={t.to}
                to={t.to}
                end={t.to === "/"}
                onClick={() => haptic(8)}
                onPointerEnter={() => prefetchRoute(t.to)}
                onTouchStart={() => prefetchRoute(t.to)}
                className={({ isActive }) =>
                  cn(
                    "relative flex flex-col items-center justify-end gap-1 text-[10px] tracking-wide uppercase transition-colors h-full",
                    isActive
                      ? t.tone === "coral" ? "text-coral" : "text-primary"
                      : "text-muted-foreground"
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    {/* Active top indicator bar */}
                    <AnimatePresence>
                      {isActive && (
                        <motion.span
                          layoutId="bn-active-bar"
                          className={cn(
                            "absolute top-0 left-1/2 -translate-x-1/2 h-[3px] w-8 rounded-full",
                            t.tone === "coral" ? "bg-coral" : "bg-primary"
                          )}
                          transition={{ type: "spring", stiffness: 500, damping: 32 }}
                        />
                      )}
                    </AnimatePresence>

                    <span className="relative">
                      <motion.span
                        animate={{ y: isActive ? -2 : 0, scale: isActive ? 1.12 : 1 }}
                        whileTap={{ scale: 0.82 }}
                        transition={{ type: "spring", stiffness: 500, damping: 22 }}
                        className="block"
                      >
                        <Icon
                          className="h-[22px] w-[22px]"
                          strokeWidth={isActive ? 2.4 : 1.8}
                          fill={isActive && t.tone === "coral" ? "currentColor" : "none"}
                        />
                      </motion.span>

                      {badge > 0 && (
                        <motion.span
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ type: "spring", stiffness: 600, damping: 20 }}
                          className="absolute -top-1.5 -right-2 min-w-[16px] h-[16px] px-1 rounded-full bg-coral text-[9px] font-bold text-coral-foreground flex items-center justify-center ring-2 ring-background"
                        >
                          {badge > 9 ? "9+" : badge}
                        </motion.span>
                      )}
                    </span>

                    <span
                      className={cn(
                        "font-semibold tracking-normal text-[10px] normal-case transition-opacity",
                        isActive ? "opacity-100" : "opacity-80"
                      )}
                    >
                      {t.label}
                    </span>
                  </>
                )}
              </NavLink>
            );
          })}
        </div>
      </nav>
    </>
  );
};
