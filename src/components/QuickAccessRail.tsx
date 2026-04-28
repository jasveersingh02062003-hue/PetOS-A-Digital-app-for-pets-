import { useNavigate } from "react-router-dom";
import {
  Heart,
  Stethoscope,
  Footprints,
  CalendarDays,
  ShoppingBag,
  Siren,
} from "lucide-react";

/**
 * Coloured quick-access chips. Each section has its own hue so the
 * app stops looking monochrome and users can build muscle memory.
 *
 * 6 items max — anything more belongs in Discover or the menu.
 */
const items: {
  to: string;
  label: string;
  icon: any;
  tone: "coral" | "sky" | "leaf" | "amber" | "primary" | "emergency";
}[] = [
  { to: "/mates", label: "Mates", icon: Heart, tone: "coral" },
  { to: "/askvet", label: "Ask vet", icon: Stethoscope, tone: "sky" },
  { to: "/walk/new", label: "Walks", icon: Footprints, tone: "leaf" },
  { to: "/meetups", label: "Meetups", icon: CalendarDays, tone: "amber" },
  { to: "/shop", label: "Shop", icon: ShoppingBag, tone: "primary" },
  { to: "/missing", label: "Missing", icon: Siren, tone: "emergency" },
];

const TONE: Record<string, { bg: string; ring: string; icon: string }> = {
  coral:    { bg: "bg-coral/12",    ring: "ring-coral/25",    icon: "text-coral" },
  sky:      { bg: "bg-sky/12",      ring: "ring-sky/25",      icon: "text-sky" },
  leaf:     { bg: "bg-leaf/12",     ring: "ring-leaf/25",     icon: "text-leaf" },
  amber:    { bg: "bg-amber/15",    ring: "ring-amber/30",    icon: "text-amber" },
  primary:  { bg: "bg-primary/10",  ring: "ring-primary/25",  icon: "text-primary" },
  emergency:{ bg: "bg-emergency/12",ring: "ring-emergency/25",icon: "text-emergency" },
};

export const QuickAccessRail = () => {
  const nav = useNavigate();
  return (
    <div className="-mx-5 mb-4">
      <div className="flex gap-3 overflow-x-auto px-5 no-scrollbar snap-x">
        {items.map((it) => {
          const Icon = it.icon;
          const t = TONE[it.tone];
          return (
            <button
              key={it.to}
              onClick={() => nav(it.to)}
              className="snap-start shrink-0 flex flex-col items-center gap-1.5 w-[64px] active:scale-95 transition-transform"
              aria-label={it.label}
            >
              <div className={`h-14 w-14 rounded-2xl ${t.bg} ring-1 ${t.ring} flex items-center justify-center`}>
                <Icon className={`h-[22px] w-[22px] ${t.icon}`} strokeWidth={2} />
              </div>
              <span className="text-[11px] font-medium text-foreground/80 leading-none">{it.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
