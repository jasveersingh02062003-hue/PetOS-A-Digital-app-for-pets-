import { NavLink, useLocation } from "react-router-dom";
import { Home, Compass, Heart, User, Siren, Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { haptic } from "@/lib/haptics";
import { prefetchRoute } from "@/lib/prefetchRoute";

/**
 * Flat 5-tab bottom nav (Instagram-style information architecture):
 *   Home · Mates · Health · Discover · Profile
 *
 * No center cutout, no global "+". Creation is handled by a per-tab
 * contextual FAB rendered in AppShell (see ContextualFab.tsx).
 * Emergency long-press lives on the contextual FAB; the small Siren
 * button stays pinned top-right of the nav for instant access.
 */
const tabs: {
  to: string;
  label: string;
  icon: any;
  tone?: "coral";
}[] = [
  { to: "/", label: "Home", icon: Home },
  { to: "/mates", label: "Mates", icon: Heart, tone: "coral" },
  { to: "/health", label: "Health", icon: Activity },
  { to: "/discover", label: "Discover", icon: Compass },
  { to: "/profile", label: "Profile", icon: User },
];

export const BottomNav = ({ onEmergency }: { onEmergency: () => void }) => {
  const loc = useLocation();

  const hidden = ["/auth", "/onboarding", "/ai"].some((p) => loc.pathname.startsWith(p)) || loc.pathname.startsWith("/admin");
  if (hidden) return null;

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
                    "flex flex-col items-center justify-end gap-1 text-[10px] tracking-wide uppercase transition-colors h-full",
                    isActive
                      ? t.tone === "coral" ? "text-coral" : "text-primary"
                      : "text-muted-foreground"
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <motion.span
                      animate={{ y: isActive ? -2 : 0, scale: isActive ? 1.1 : 1 }}
                      whileTap={{ scale: 0.85 }}
                      transition={{ type: "spring", stiffness: 500, damping: 22 }}
                    >
                      <Icon
                        className="h-[22px] w-[22px]"
                        strokeWidth={isActive ? 2.4 : 1.8}
                        fill={isActive && t.tone === "coral" ? "currentColor" : "none"}
                      />
                    </motion.span>
                    <span className="font-semibold tracking-normal text-[10px] normal-case">{t.label}</span>
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
