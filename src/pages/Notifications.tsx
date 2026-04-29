import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useNotifications, type Notification } from "@/hooks/useNotifications";
import { usePendingCollabInvites, useRespondCollab } from "@/hooks/useCollabs";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  ArrowLeft, Bell, Check, Users, Heart, MessageSquare, Calendar, ShoppingBag,
  Stethoscope, Sparkles, AlertTriangle, MapPin, UserPlus, ShieldCheck, X,
} from "lucide-react";
import { formatDistanceToNow, isToday, isThisWeek } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { AuthorIdentity } from "@/components/AuthorIdentity";

type Filter = "all" | "unread" | "social" | "bookings" | "alerts";

const ICONS: Record<string, { icon: any; tone: string }> = {
  new_message: { icon: MessageSquare, tone: "text-sky bg-sky/10" },
  post_comment: { icon: MessageSquare, tone: "text-sky bg-sky/10" },
  new_follower: { icon: UserPlus, tone: "text-lilac bg-lilac/10" },
  collab_accepted: { icon: Check, tone: "text-emerald-600 bg-emerald-500/10" },
  collab_declined: { icon: X, tone: "text-muted-foreground bg-muted" },
  mate_request: { icon: Heart, tone: "text-coral bg-coral/10" },
  mate_status: { icon: Heart, tone: "text-coral bg-coral/10" },
  meetup_rsvp: { icon: Calendar, tone: "text-amber-600 bg-amber-500/10" },
  appt_new: { icon: Stethoscope, tone: "text-sky bg-sky/10" },
  appt_status: { icon: Stethoscope, tone: "text-sky bg-sky/10" },
  access_request: { icon: ShieldCheck, tone: "text-amber-600 bg-amber-500/10" },
  access_approved: { icon: ShieldCheck, tone: "text-emerald-600 bg-emerald-500/10" },
  access_rejected: { icon: ShieldCheck, tone: "text-muted-foreground bg-muted" },
  trust_status: { icon: ShieldCheck, tone: "text-sky bg-sky/10" },
  missing_pet: { icon: AlertTriangle, tone: "text-coral bg-coral/10" },
  sighting: { icon: MapPin, tone: "text-coral bg-coral/10" },
  order: { icon: ShoppingBag, tone: "text-emerald-600 bg-emerald-500/10" },
};

const CATEGORY: Record<string, Filter> = {
  new_message: "social", post_comment: "social", new_follower: "social",
  collab_accepted: "social", collab_declined: "social",
  mate_request: "social", mate_status: "social", meetup_rsvp: "social",
  appt_new: "bookings", appt_status: "bookings", order: "bookings",
  missing_pet: "alerts", sighting: "alerts",
  access_request: "alerts", access_approved: "alerts", access_rejected: "alerts",
  trust_status: "alerts",
};

const groupKey = (iso: string) => {
  const d = new Date(iso);
  if (isToday(d)) return "Today";
  if (isThisWeek(d, { weekStartsOn: 1 })) return "This week";
  return "Earlier";
};

const Notifications = () => {
  const nav = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data, unreadCount, markAllRead, markRead } = useNotifications();
  const { data: invites } = usePendingCollabInvites();
  const respond = useRespondCollab();
  const [filter, setFilter] = useState<Filter>("all");

  const filtered = useMemo(() => {
    const list = data ?? [];
    if (filter === "all") return list;
    if (filter === "unread") return list.filter((n) => !n.read_at);
    return list.filter((n) => CATEGORY[n.type] === filter);
  }, [data, filter]);

  const grouped = useMemo(() => {
    const out: Record<string, Notification[]> = { Today: [], "This week": [], Earlier: [] };
    for (const n of filtered) out[groupKey(n.created_at)].push(n);
    return out;
  }, [filtered]);

  const dismiss = async (id: string) => {
    await supabase.from("notifications").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["notifications", user?.id] });
  };

  return (
    <div className="container-app pad-top-safe pb-24">
      <header className="sticky top-0 z-20 bg-background/95 backdrop-blur -mx-4 sm:-mx-6 px-4 sm:px-6 pt-4 pb-3">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => nav(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="font-display text-2xl flex-1">
            Notifications
            {unreadCount > 0 && (
              <span className="ml-2 text-[11px] align-middle bg-coral text-white rounded-full px-2 py-0.5 font-semibold">
                {unreadCount}
              </span>
            )}
          </h1>
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" className="rounded-full" onClick={markAllRead}>
              <Check className="h-3.5 w-3.5 mr-1" /> Mark all read
            </Button>
          )}
        </div>
        <div className="flex gap-2 overflow-x-auto no-scrollbar mt-3 pb-1 -mx-1 px-1">
          {([
            { key: "all", label: "All" },
            { key: "unread", label: `Unread${unreadCount ? ` (${unreadCount})` : ""}` },
            { key: "social", label: "Social" },
            { key: "bookings", label: "Bookings" },
            { key: "alerts", label: "Alerts" },
          ] as { key: Filter; label: string }[]).map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`shrink-0 h-8 px-3 rounded-full text-xs font-medium border transition ${
                filter === f.key ? "bg-foreground text-background border-foreground" : "bg-card text-muted-foreground border-hairline"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </header>

      {(invites?.length ?? 0) > 0 && (
        <div className="mb-4 space-y-2 mt-4">
          <div className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 px-1">
            <Users className="h-3.5 w-3.5" /> Collab invites
          </div>
          {invites!.map((inv: any) => (
            <Card key={inv.post_id} className="rounded-2xl border-primary/30 bg-primary/5 p-3">
              <div className="flex items-center gap-3">
                {inv.posts?.image_url && (
                  <img src={inv.posts.image_url} alt="" className="h-14 w-14 rounded-lg object-cover" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">You've been tagged in a post</div>
                  {inv.posts?.caption && (
                    <div className="text-xs text-muted-foreground truncate">{inv.posts.caption}</div>
                  )}
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <Button size="sm" className="flex-1 rounded-xl" onClick={() => respond.mutate({ postId: inv.post_id, accept: true })}>
                  Accept
                </Button>
                <Button size="sm" variant="outline" className="flex-1 rounded-xl border-hairline" onClick={() => respond.mutate({ postId: inv.post_id, accept: false })}>
                  Decline
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {filtered.length === 0 && (
        <Card className="rounded-2xl border-hairline p-10 text-center mt-4">
          <Bell className="h-10 w-10 mx-auto text-muted-foreground mb-3" strokeWidth={1.5} />
          <p className="text-sm text-muted-foreground">
            {filter === "unread" ? "Nothing unread. Nice." : filter === "all" ? "You're all caught up." : "Nothing here yet."}
          </p>
        </Card>
      )}

      {(["Today", "This week", "Earlier"] as const).map((section) =>
        grouped[section].length > 0 ? (
          <div key={section} className="mt-5">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground px-1 mb-2 font-semibold">
              {section}
            </div>
            <div className="space-y-2">
              {grouped[section].map((n) => {
                const meta = ICONS[n.type] ?? { icon: Sparkles, tone: "text-muted-foreground bg-muted" };
                const Icon = meta.icon;
                return (
                  <Card
                    key={n.id}
                    className={`group rounded-2xl border-hairline p-3 cursor-pointer hover:bg-muted/40 transition-colors ${
                      !n.read_at ? "bg-primary/5 border-primary/20" : ""
                    }`}
                    onClick={async () => {
                      await markRead(n.id);
                      if (n.link) nav(n.link);
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`h-9 w-9 rounded-xl grid place-items-center shrink-0 ${meta.tone}`}>
                        <Icon className="h-4 w-4" strokeWidth={2.2} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start gap-2">
                          <div className="text-sm font-medium leading-snug flex-1">{n.title}</div>
                          {!n.read_at && <span className="h-2 w-2 rounded-full bg-coral mt-1.5 shrink-0" />}
                        </div>
                        {n.body && (
                          <div className="text-[12px] text-muted-foreground mt-0.5 line-clamp-2">{n.body}</div>
                        )}
                        <div className="flex items-center justify-between mt-1">
                          <div className="text-[11px] text-muted-foreground">
                            {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                          </div>
                          <button
                            onClick={(e) => { e.stopPropagation(); dismiss(n.id); }}
                            className="text-[11px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity hover:text-foreground"
                            aria-label="Dismiss"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        ) : null,
      )}
    </div>
  );
};

export default Notifications;
