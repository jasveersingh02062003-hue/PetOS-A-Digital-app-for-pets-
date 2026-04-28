import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, MessageCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";

type Row = {
  conversation_id: string;
  is_group: boolean;
  title: string | null;
  last_message_at: string;
  last_read_at: string;
  other_user_id: string | null;
  other_name: string | null;
  other_avatar: string | null;
  preview: string | null;
  unread: number;
};

export default function Messages() {
  const nav = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { nav("/auth", { replace: true }); return; }
    load();
    const ch = supabase
      .channel("messages-inbox")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line
  }, [user, authLoading]);

  async function load() {
    setLoading(true);
    const { data: members } = await supabase
      .from("conversation_members" as any)
      .select("conversation_id,last_read_at")
      .eq("user_id", user!.id);
    const ids = (members ?? []).map((m: any) => m.conversation_id);
    if (!ids.length) { setRows([]); setLoading(false); return; }

    const { data: convs } = await supabase
      .from("conversations" as any)
      .select("id,is_group,title,last_message_at")
      .in("id", ids)
      .order("last_message_at", { ascending: false });

    const { data: allMembers } = await supabase
      .from("conversation_members" as any)
      .select("conversation_id,user_id")
      .in("conversation_id", ids);

    const otherIds = Array.from(new Set(((allMembers ?? []) as any[])
      .filter(m => m.user_id !== user!.id)
      .map(m => m.user_id)));
    const { data: profiles } = await supabase.rpc("get_profiles_public");
    const profMap = new Map<string, any>(((profiles ?? []) as any[]).map(p => [p.id, p]));

    const out: Row[] = [];
    for (const c of (convs ?? []) as any[]) {
      const myMember = (members ?? []).find((m: any) => m.conversation_id === c.id);
      const others = ((allMembers ?? []) as any[])
        .filter(m => m.conversation_id === c.id && m.user_id !== user!.id);
      const other = others[0] ? profMap.get(others[0].user_id) : null;

      const { data: lastMsg } = await supabase
        .from("messages" as any)
        .select("body,attachment_kind,created_at")
        .eq("conversation_id", c.id)
        .order("created_at", { ascending: false })
        .limit(1);

      const { count: unread } = await supabase
        .from("messages" as any)
        .select("*", { count: "exact", head: true })
        .eq("conversation_id", c.id)
        .gt("created_at", myMember?.last_read_at ?? "1970-01-01");

      out.push({
        conversation_id: c.id,
        is_group: c.is_group,
        title: c.title,
        last_message_at: c.last_message_at,
        last_read_at: myMember?.last_read_at ?? c.last_message_at,
        other_user_id: other?.id ?? null,
        other_name: other?.full_name ?? c.title ?? "Conversation",
        other_avatar: other?.avatar_url ?? null,
        preview: (lastMsg?.[0] as any)?.body ?? ((lastMsg?.[0] as any)?.attachment_kind ? `[${(lastMsg?.[0] as any).attachment_kind}]` : null),
        unread: unread ?? 0,
      });
    }
    setRows(out);
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-hairline">
        <div className="container-app h-14 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => nav(-1)}><ArrowLeft className="h-5 w-5" /></Button>
          <div className="font-display text-lg">Messages</div>
        </div>
      </header>

      <main className="container-app py-4">
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin mx-auto mt-12" />
        ) : rows.length === 0 ? (
          <div className="text-center py-16 space-y-3">
            <MessageCircle className="h-10 w-10 mx-auto text-muted-foreground" />
            <div className="text-sm text-muted-foreground">No conversations yet.</div>
            <p className="text-xs text-muted-foreground">Visit a profile and tap Message to start one.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {rows.map(r => (
              <Card
                key={r.conversation_id}
                onClick={() => nav(`/messages/${r.conversation_id}`)}
                className="p-3 flex items-center gap-3 cursor-pointer hover:bg-muted/50 active:scale-[0.99] transition"
              >
                <Avatar className="h-12 w-12">
                  <AvatarImage src={r.other_avatar ?? undefined} />
                  <AvatarFallback>{(r.other_name ?? "?").slice(0,1).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-medium truncate">{r.other_name}</div>
                    <div className="text-[10px] text-muted-foreground shrink-0">
                      {formatDistanceToNow(new Date(r.last_message_at), { addSuffix: true })}
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm text-muted-foreground truncate">{r.preview ?? "Say hi 👋"}</div>
                    {r.unread > 0 && <Badge className="h-5 min-w-5 px-1.5">{r.unread}</Badge>}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
