import { Link, useNavigate } from "react-router-dom";
import { Search, Bell } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useProfile } from "@/hooks/useProfile";
import { useNotifications } from "@/hooks/useNotifications";
import { cn } from "@/lib/utils";

/**
 * The Petos brand bar. The single source of app identity at the top of Home.
 *
 * Layout: [glyph + wordmark]  ·  flex spacer  ·  [search] [bell] [avatar]
 *
 * - Sticky, glass-morphism background so the feed scrolls beneath it
 * - The avatar opens the "Today panel" — where the pet hero card now lives
 * - No greeting, no goal chips. Identity only.
 *
 * This is the structural break from looking like a generic dashboard:
 * Instagram, TikTok, Twitter all open with their wordmark, not "Hi Joe".
 */
export const HomeTopBar = ({
  onAvatarClick,
}: {
  onAvatarClick?: () => void;
}) => {
  const nav = useNavigate();
  const { data: profile } = useProfile();
  const { unreadCount } = useNotifications();
  const initial = profile?.full_name?.[0]?.toUpperCase() ?? "P";

  return (
    <div
      className={cn(
        "sticky top-0 z-30 -mx-4 px-4 h-14 flex items-center gap-2",
        "bg-background/80 backdrop-blur-xl",
        "border-b border-hairline/60"
      )}
    >
      <Link to="/" aria-label="Petos home" className="flex items-center gap-1.5 group">
        <span className="text-primary inline-flex">
          <img src="/brand/petos-glyph.svg" alt="" className="h-7 w-7" />
        </span>
        <span className="font-display text-[22px] leading-none tracking-tight font-semibold text-foreground group-active:scale-[0.97] transition-transform">
          petos
        </span>
        <span className="bg-primary/10 text-primary text-[10px] font-bold px-1.5 py-0.5 rounded-full border border-primary/20 ml-0.5">
          V2
        </span>
      </Link>

      <div className="flex-1" />

      <button
        onClick={() => nav("/search")}
        aria-label="Search"
        className="h-10 w-10 inline-flex items-center justify-center rounded-full hover:bg-muted active:scale-95 transition-all text-foreground"
      >
        <Search className="h-[22px] w-[22px]" strokeWidth={1.8} />
      </button>

      <button
        onClick={() => nav("/notifications")}
        aria-label="Notifications"
        className="h-10 w-10 inline-flex items-center justify-center rounded-full hover:bg-muted active:scale-95 transition-all text-foreground relative"
      >
        <Bell className="h-[22px] w-[22px]" strokeWidth={1.8} />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-coral ring-2 ring-background" />
        )}
      </button>

      <button
        onClick={onAvatarClick}
        aria-label="Open today panel"
        className="ml-0.5 active:scale-95 transition-transform"
      >
        <Avatar className="h-9 w-9 ring-2 ring-primary/40 ring-offset-1 ring-offset-background">
          <AvatarImage src={profile?.avatar_url ?? undefined} alt="" />
          <AvatarFallback className="bg-primary-soft text-primary text-sm font-semibold">{initial}</AvatarFallback>
        </Avatar>
      </button>
    </div>
  );
};

export default HomeTopBar;
