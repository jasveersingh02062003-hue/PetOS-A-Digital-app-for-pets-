import { NavLink, useLocation } from "react-router-dom";
import { useRef } from "react";
import { Home, Compass, Heart, ShoppingBag, User, Plus, Siren } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { haptic } from "@/lib/haptics";

const tabs = [
  { to: "/", label: "Home", icon: Home },
  { to: "/discover", label: "Discover", icon: Compass },
  { to: "/health", label: "Health", icon: Heart, center: true },
  { to: "/services", label: "Services", icon: ShoppingBag },
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
    window.dispatchEvent(new CustomEvent("petos:open-composer"));
  };

  return (
    <>
      <button
        onPointerDown={startPress}
        onPointerUp={endPress}
        onPointerLeave={endPress}
        onPointerCancel={endPress}
        onClick={handleClick}
        aria-label="Create post (long-press for emergency)"
        className="fixed left-1/2 -translate-x-1/2 z-50 bg-primary text-primary-foreground rounded-full h-14 w-14 flex items-center justify-center shadow-[0_8px_24px_-6px_hsl(var(--primary)/0.45)] active:scale-95 transition-transform"
        style={{ bottom: `calc(2.75rem + env(safe-area-inset-bottom))` }}
      >
        <Plus className="h-6 w-6" strokeWidth={2} />
      </button>
      <button
        onClick={onEmergency}
        aria-label="Emergency assistant"
        className="fixed right-4 z-50 bg-emergency text-emergency-foreground rounded-full h-11 w-11 flex items-center justify-center shadow-md active:scale-95 transition-transform"
        style={{ bottom: `calc(5.25rem + env(safe-area-inset-bottom))` }}
      >
        <Siren className="h-5 w-5" strokeWidth={1.75} />
      </button>
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-xl border-t border-hairline"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="mx-auto max-w-[480px] grid grid-cols-5 h-[4.25rem]">
          {tabs.map((t) => {
            const Icon = t.icon;
            return (
              <NavLink
                key={t.to}
                to={t.to}
                end={t.to === "/"}
                onClick={() => haptic(8)}
                className={({ isActive }) =>
                  cn(
                    "flex flex-col items-center justify-center gap-1 text-[10px] tracking-wide uppercase transition-colors",
                    t.center && "opacity-0 pointer-events-none",
                    isActive ? "text-primary" : "text-muted-foreground"
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <motion.span
                      animate={{ y: isActive ? -2 : 0, scale: isActive ? 1.08 : 1 }}
                      whileTap={{ scale: 0.85 }}
                      transition={{ type: "spring", stiffness: 500, damping: 22 }}
                    >
                      <Icon className="h-[22px] w-[22px]" strokeWidth={1.6} />
                    </motion.span>
                    <span className="font-medium">{t.label}</span>
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
