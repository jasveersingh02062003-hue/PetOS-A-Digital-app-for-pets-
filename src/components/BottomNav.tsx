import { NavLink, useLocation } from "react-router-dom";
import { useRef } from "react";
import { Home, Compass, Heart, User, Plus, Siren, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { haptic } from "@/lib/haptics";

/**
 * Bottom nav with a CENTER FAB that creates a post and an inline
 * "Mates" tab next to it (replacing the old hidden Health slot).
 *
 * Layout:  Home · Discover · [+ FAB] · Mates · Profile
 * Health is reachable from the Pet hero card and the quick rail.
 */
const tabs = [
  { to: "/", label: "Home", icon: Home },
  { to: "/discover", label: "Discover", icon: Compass },
  { center: true } as any,
  { to: "/mates", label: "Mates", icon: Heart, tone: "coral" as const },
  { to: "/profile", label: "Profile", icon: User },
];

export const BottomNav = ({ onEmergency }: { onEmergency: () => void }) => {
  const loc = useLocation();
  const pressTimer = useRef<number | null>(null);
  const longPressed = useRef(false);

  const hidden = ["/auth", "/onboarding", "/ai"].some((p) => loc.pathname.startsWith(p)) || loc.pathname.startsWith("/admin");
  if (hidden) return null;

  const startPress = () => {
    longPressed.current = false;
    pressTimer.current = window.setTimeout(() => {
      longPressed.current = true;
      if (navigator.vibrate) navigator.vibrate(20);
      onEmergency();
    }, 550);
  };
  const endPress = () => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  };
  const handleClick = () => {
    if (longPressed.current) return;
    haptic(10);
    window.dispatchEvent(new CustomEvent("petos:open-composer"));
  };

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
          {tabs.map((t, i) => {
            if (t.center) {
              return (
                <div key="center" className="flex justify-center">
                  <button
                    onPointerDown={startPress}
                    onPointerUp={endPress}
                    onPointerLeave={endPress}
                    onPointerCancel={endPress}
                    onClick={handleClick}
                    aria-label="Create post (long-press for emergency)"
                    className="relative -mt-7 h-14 w-14 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-[0_10px_28px_-6px_hsl(var(--primary)/0.55)] active:scale-95 transition-transform ring-4 ring-background"
                  >
                    <Plus className="h-6 w-6" strokeWidth={2.4} />
                    <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-coral flex items-center justify-center">
                      <Sparkles className="h-2.5 w-2.5 text-white" strokeWidth={2.5} />
                    </span>
                  </button>
                </div>
              );
            }
            const Icon = t.icon;
            return (
              <NavLink
                key={t.to}
                to={t.to}
                end={t.to === "/"}
                onClick={() => haptic(8)}
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
