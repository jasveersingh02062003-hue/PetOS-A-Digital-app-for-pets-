import { useLocation, useNavigate } from "react-router-dom";
import { useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Plus, Heart, Activity, PawPrint, GitBranch, HandCoins, CalendarDays, Briefcase } from "lucide-react";
import { haptic } from "@/lib/haptics";
import { QuickLogSheet } from "@/components/health/QuickLogSheet";
import { useProfile } from "@/hooks/useProfile";

type FabConfig = {
  icon: any;
  label: string;
  tone: string; // tailwind classes for bg + text
  onPress: () => void;
};

const HIDDEN_PREFIXES = ["/auth", "/onboarding", "/ai", "/admin", "/welcome", "/post-auth"];

/**
 * Per-tab contextual FAB. Renders a different action depending on the
 * active route. Long-press still triggers the global emergency sheet so
 * the gesture survives the nav refactor.
 */
export const ContextualFab = ({ onEmergency }: { onEmergency: () => void }) => {
  const loc = useLocation();
  const nav = useNavigate();
  const { data: profile } = useProfile();
  const [quickLogOpen, setQuickLogOpen] = useState(false);
  const pressTimer = useRef<number | null>(null);
  const longPressed = useRef(false);

  if (HIDDEN_PREFIXES.some((p) => loc.pathname.startsWith(p))) return null;

  const path = loc.pathname;
  const accountType = ((profile as any)?.account_type ?? "pet_parent") as string;
  let config: FabConfig | null = null;

  if (path === "/") {
    // Role-aware primary action on the Home dashboard.
    // Default (pet_parent / buyer / fallback) keeps the universal composer.
    switch (accountType) {
      case "breeder":
      case "kennel":
        config = {
          icon: GitBranch,
          label: "New litter",
          tone: "bg-amber-500 text-white",
          onPress: () => nav("/litter/new"),
        };
        break;
      case "shelter":
      case "rescuer":
        config = {
          icon: PawPrint,
          label: "List a pet for adoption",
          tone: "bg-lilac text-white",
          onPress: () => nav("/mates/adopt/new"),
        };
        break;
      case "sanctuary":
        config = {
          icon: HandCoins,
          label: "Manage donations",
          tone: "bg-leaf text-white",
          onPress: () => nav("/org/donations"),
        };
        break;
      case "zoo":
        config = {
          icon: CalendarDays,
          label: "New event",
          tone: "bg-stone-700 text-white",
          onPress: () => nav("/meetups/new"),
        };
        break;
      case "provider":
        config = {
          icon: Briefcase,
          label: "New service",
          tone: "bg-primary text-primary-foreground",
          onPress: () => nav("/services/new"),
        };
        break;
      default:
        config = {
          icon: Plus,
          label: "New post",
          tone: "bg-primary text-primary-foreground",
          onPress: () => window.dispatchEvent(new CustomEvent("petos:open-composer")),
        };
    }
  } else if (path === "/mates" || path.startsWith("/mates/")) {
    // Hide on sub-routes that are themselves creation/detail screens
    if (path === "/mates") {
      const tab = new URLSearchParams(loc.search).get("tab");
      if (tab === "adopt") {
        config = {
          icon: PawPrint,
          label: "List a pet for adoption",
          tone: "bg-leaf text-white",
          onPress: () => nav("/mates/adopt/new"),
        };
      } else {
        config = {
          icon: Heart,
          label: "New mating listing",
          tone: "bg-coral text-coral-foreground",
          onPress: () => nav("/mates/new"),
        };
      }
    }
  } else if (path === "/health") {
    config = {
      icon: Activity,
      label: "Log health entry",
      tone: "bg-leaf text-white",
      onPress: () => setQuickLogOpen(true),
    };
  }
  // /discover and /profile intentionally have no FAB.

  if (!config) {
    return <QuickLogSheet open={quickLogOpen} onOpenChange={setQuickLogOpen} />;
  }

  const Icon = config.icon;

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
    config!.onPress();
  };

  return (
    <>
      <AnimatePresence mode="wait">
        <motion.button
          key={path}
          initial={{ opacity: 0, scale: 0.8, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: 8 }}
          transition={{ type: "spring", stiffness: 500, damping: 28 }}
          onPointerDown={startPress}
          onPointerUp={endPress}
          onPointerLeave={endPress}
          onPointerCancel={endPress}
          onClick={handleClick}
          aria-label={`${config.label} (long-press for emergency)`}
          className={`fixed left-4 z-40 h-14 w-14 rounded-full ${config.tone} shadow-[0_10px_28px_-6px_hsl(var(--primary)/0.45)] flex items-center justify-center active:scale-95 transition-transform`}
          style={{ bottom: `calc(5.25rem + env(safe-area-inset-bottom))` }}
        >
          <Icon className="h-6 w-6" strokeWidth={2.4} />
        </motion.button>
      </AnimatePresence>
      <QuickLogSheet open={quickLogOpen} onOpenChange={setQuickLogOpen} />
    </>
  );
};