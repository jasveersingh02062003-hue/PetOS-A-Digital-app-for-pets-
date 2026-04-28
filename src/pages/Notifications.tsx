import { useNavigate } from "react-router-dom";
import { useNotifications } from "@/hooks/useNotifications";
import { usePendingCollabInvites, useRespondCollab } from "@/hooks/useCollabs";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Bell, Check, Users } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const Notifications = () => {
  const nav = useNavigate();
  const { data, unreadCount, markAllRead, markRead } = useNotifications();
  const { data: invites } = usePendingCollabInvites();
  const respond = useRespondCollab();

  return (
    <div className="container-app pad-top-safe pb-24">
      <header className="pt-4 pb-4 flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => nav(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="font-display text-2xl flex-1">Notifications</h1>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" className="rounded-full" onClick={markAllRead}>
            <Check className="h-3.5 w-3.5 mr-1" /> Mark all read
          </Button>
        )}
      </header>

      {(invites?.length ?? 0) > 0 && (
        <div className="mb-4 space-y-2">
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

      {(data?.length ?? 0) === 0 && (
        <Card className="rounded-2xl border-hairline p-10 text-center">
          <Bell className="h-10 w-10 mx-auto text-muted-foreground mb-3" strokeWidth={1.5} />
          <p className="text-sm text-muted-foreground">You're all caught up.</p>
        </Card>
      )}

      <div className="space-y-2">
        {data?.map((n) => (
          <Card
            key={n.id}
            className={`rounded-2xl border-hairline p-4 cursor-pointer hover:bg-muted/40 transition-colors ${
              !n.read_at ? "bg-primary/5 border-primary/20" : ""
            }`}
            onClick={async () => {
              await markRead(n.id);
              if (n.link) nav(n.link);
            }}
          >
            <div className="flex items-start gap-3">
              {!n.read_at && (
                <span className="h-2 w-2 rounded-full bg-primary mt-1.5 flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">{n.title}</div>
                {n.body && <div className="text-sm text-muted-foreground mt-0.5">{n.body}</div>}
                <div className="text-xs text-muted-foreground mt-1">
                  {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default Notifications;
