import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft, Send, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useIsOnline } from "@/hooks/usePresence";

type Msg = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string | null;
  attachment_url: string | null;
  attachment_kind: string | null;
  created_at: string;
};

export default function MessageThread() {
  const { id: convId } = useParams();
  const { user, loading: authLoading } = useAuth();
  const nav = useNavigate();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [otherTyping, setOtherTyping] = useState(false);
  const [other, setOther] = useState<{ id: string; name: string; avatar: string | null } | null>(null);
  const otherOnline = useIsOnline(other?.id);
  const scrollRef = useRef<HTMLDivElement>(null);
  const typingTimer = useRef<number | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { nav("/auth", { replace: true }); return; }
    if (!convId) return;
    load();

    const ch = supabase
      .channel(`thread-${convId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${convId}` },
        (payload) => {
          setMessages(prev => [...prev, payload.new as Msg]);
          // mark read
          supabase.rpc("mark_conversation_read" as any, { _conv: convId });
        })
      .on("postgres_changes", { event: "*", schema: "public", table: "typing_indicators", filter: `conversation_id=eq.${convId}` },
        (payload: any) => {
          const row = payload.new ?? payload.old;
          if (!row || row.user_id === user.id) return;
          if (payload.eventType === "DELETE") { setOtherTyping(false); return; }
          const age = Date.now() - new Date(row.updated_at).getTime();
          setOtherTyping(age < 5000);
          window.setTimeout(() => setOtherTyping(false), 5000);
        })
      .subscribe();

    supabase.rpc("mark_conversation_read" as any, { _conv: convId });
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line
  }, [convId, authLoading, user]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, otherTyping]);

  async function load() {
    const { data: msgs } = await supabase
      .from("messages" as any)
      .select("*")
      .eq("conversation_id", convId!)
      .order("created_at");
    setMessages((msgs as any[]) ?? []);

    const { data: members } = await supabase
      .from("conversation_members" as any)
      .select("user_id")
      .eq("conversation_id", convId!);
    const otherId = ((members ?? []) as any[]).map(m => m.user_id).find(uid => uid !== user!.id);
    if (otherId) {
      const { data: profs } = await supabase.rpc("get_profiles_public");
      const p = ((profs ?? []) as any[]).find(x => x.id === otherId);
      if (p) setOther({ id: p.id, name: p.full_name ?? "User", avatar: p.avatar_url });
    }
  }

  async function send() {
    const text = body.trim();
    if (!text || sending) return;
    setSending(true);
    const { error } = await supabase.from("messages" as any).insert({
      conversation_id: convId!,
      sender_id: user!.id,
      body: text,
    });
    setSending(false);
    if (error) return toast.error(error.message);
    setBody("");
    // clear typing
    await supabase.from("typing_indicators" as any).delete()
      .eq("conversation_id", convId!).eq("user_id", user!.id);
  }

  function onChange(v: string) {
    setBody(v);
    if (!convId || !user) return;
    supabase.from("typing_indicators" as any).upsert({
      conversation_id: convId, user_id: user.id, updated_at: new Date().toISOString(),
    });
    if (typingTimer.current) window.clearTimeout(typingTimer.current);
    typingTimer.current = window.setTimeout(() => {
      supabase.from("typing_indicators" as any).delete()
        .eq("conversation_id", convId).eq("user_id", user.id);
    }, 4000);
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-hairline">
        <div className="container-app h-14 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => nav("/messages")}><ArrowLeft className="h-5 w-5" /></Button>
          {other && (
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => nav(`/u/${other.id}`)}>
              <Avatar className="h-9 w-9">
                <AvatarImage src={other.avatar ?? undefined} />
                <AvatarFallback>{other.name.slice(0,1).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div>
                <div className="font-medium leading-tight">{other.name}</div>
                <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                  {!otherTyping && (
                    <span
                      aria-hidden
                      className={`inline-block h-1.5 w-1.5 rounded-full ${otherOnline ? "bg-leaf" : "bg-muted-foreground/40"}`}
                    />
                  )}
                  {otherTyping ? "typing…" : otherOnline ? "online" : "offline"}
                </div>
              </div>
            </div>
          )}
        </div>
      </header>

      <main ref={scrollRef} className="flex-1 overflow-y-auto container-app py-4 space-y-2">
        {messages.map(m => {
          const mine = m.sender_id === user?.id;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm ${
                mine ? "bg-primary text-primary-foreground rounded-br-md" : "bg-muted rounded-bl-md"
              }`}>
                {m.body}
                <div className={`text-[10px] mt-0.5 ${mine ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                  {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
            </div>
          );
        })}
        {otherTyping && (
          <div className="flex justify-start">
            <div className="px-3 py-2 rounded-2xl bg-muted text-xs text-muted-foreground">typing…</div>
          </div>
        )}
      </main>

      <footer className="sticky bottom-0 bg-background border-t border-hairline">
        <div className="container-app py-3 flex gap-2">
          <Input
            value={body}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="Message…"
            className="rounded-full"
          />
          <Button onClick={send} disabled={sending || !body.trim()} size="icon" className="rounded-full">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </footer>
    </div>
  );
}
