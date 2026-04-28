import { useNavigate } from "react-router-dom";
import {
  MessageCircle,
  Bell,
  CalendarDays,
  Stethoscope,
  Search as SearchIcon,
  Heart,
  Footprints,
  Camera,
  ShoppingBag,
  Users,
} from "lucide-react";
import { useNotifications } from "@/hooks/useNotifications";

const items = [
  { to: "/messages", label: "Messages", icon: MessageCircle },
  { to: "/notifications", label: "Alerts", icon: Bell, badgeKey: "alerts" as const },
  { to: "/meetups", label: "Meetups", icon: CalendarDays },
  { to: "/askvet", label: "Ask vet", icon: Stethoscope },
  { to: "/missing", label: "Missing", icon: Heart },
  { to: "/mates", label: "Mates", icon: Users },
  { to: "/walk", label: "Walks", icon: Footprints },
  { to: "/ai/photo-vet", label: "Photo vet", icon: Camera },
  { to: "/shop", label: "Shop", icon: ShoppingBag },
  { to: "/search", label: "Search", icon: SearchIcon },
];

export const QuickAccessRail = () => {
  const nav = useNavigate();
  const { data: notifs } = useNotifications();
  const unread = (notifs ?? []).filter((n) => !n.read_at).length;
  return (
    <div className="-mx-4 mb-3">
      <div className="flex gap-2 overflow-x-auto px-4 no-scrollbar snap-x snap-mandatory">
        {items.map((it) => {
          const Icon = it.icon;
          const showBadge = it.badgeKey === "alerts" && unread > 0;
          return (
            <button
              key={it.to}
              onClick={() => nav(it.to)}
              className="snap-start shrink-0 flex flex-col items-center gap-1.5 w-[68px] active:scale-95 transition-transform"
              aria-label={it.label}
            >
              <div className="relative h-12 w-12 rounded-2xl bg-secondary/60 border border-hairline flex items-center justify-center">
                <Icon className="h-[20px] w-[20px] text-foreground/80" strokeWidth={1.6} />
                {showBadge && (
                  <span className="absolute -top-1 -right-1 h-4 min-w-4 px-1 rounded-full bg-emergency text-emergency-foreground text-[10px] font-semibold flex items-center justify-center">
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
              </div>
              <span className="text-[10.5px] text-muted-foreground leading-none">{it.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
