import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft, Send, Loader2, ImagePlus, X, Check, CheckCheck, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { useIsOnline } from "@/hooks/usePresence";
import { uploadImageWithVariants } from "@/lib/uploadImage";
import { UserStreakChip } from "@/components/social/UserStreakChip";
import { LiveWalkChip } from "@/components/walker/LiveWalkChip";

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
  const [other, setOther] = useState<{ id: string; name: string; avatar: string | null; accountType: string | null; orgApproved: boolean } | null>(null);
  const [warningDismissed, setWarningDismissed] = useState(false);
  const [otherLastReadAt, setOtherLastReadAt] = useState<string | null>(null);
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const otherOnline = useIsOnline(other?.id);
  const scrollRef = useRef<HTMLDivElement>(null);
  const typingTimer = useRef<number | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { nav("/auth", { replace: true }); return; }
    if (!convId) return;
    load();
    // Persist "warning shown" per thread so it only appears once.
    setWarningDismissed(localStorage.getItem(`petos:rescuer-warn:${convId}`) === "1");

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
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "conversation_members", filter: `conversation_id=eq.${convId}` },
        (payload: any) => {
          const row = payload.new;
          if (!row || row.user_id === user.id) return;
          if (row.last_read_at) setOtherLastReadAt(row.last_read_at);
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
      .select("user_id, last_read_at")
      .eq("conversation_id", convId!);
    const otherMember = ((members ?? []) as any[]).find(m => m.user_id !== user!.id);
    const otherId = otherMember?.user_id;
    if (otherMember?.last_read_at) setOtherLastReadAt(otherMember.last_read_at);
    if (otherId) {
      const { data: profs } = await supabase.rpc("get_profiles_public");
      const p = ((profs ?? []) as any[]).find(x => x.id === otherId);
      if (p) {
        const { data: org } = await supabase
          .from("org_profiles").select("status").eq("user_id", otherId).maybeSingle();
        setOther({
          id: p.id,
          name: p.full_name ?? "User",
          avatar: p.avatar_url,
          accountType: (p as any).account_type ?? null,
          orgApproved: (org as any)?.status === "approved",
        });
      }
    }
  }

  async function send() {
    const text = body.trim();
    if ((!text && !pendingImage) || sending) return;
    setSending(true);
    const { error } = await supabase.from("messages" as any).insert({
      conversation_id: convId!,
      sender_id: user!.id,
      body: text || null,
      attachment_url: pendingImage,
      attachment_kind: pendingImage ? "image" : null,
    });
    setSending(false);
    if (error) return toast.error(error.message);
    setBody("");
    setPendingImage(null);
    // clear typing
    await supabase.from("typing_indicators" as any).delete()
      .eq("conversation_id", convId!).eq("user_id", user!.id);
  }

  async function pickImage(file: File) {
    if (!file.type.startsWith("image/")) return toast.error("Please choose an image");
    setUploading(true);
    try {
      const v = await uploadImageWithVariants(file, "posts" as any);
      setPendingImage(v.full || v.thumb || null);
    } catch (e: any) {
      toast.error(e?.message ?? "Upload failed");
    } finally {
      setUploading(false);
    }
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

  // Group consecutive messages by sender + time (5 min) and add date dividers
  const grouped = useMemo(() => {
    const out: Array<{ kind: "divider"; label: string } | { kind: "msg"; m: Msg; showTail: boolean; firstOfBurst: boolean }> = [];
    let lastDate = "";
    for (let i = 0; i < messages.length; i++) {
      const m = messages[i];
      const date = new Date(m.created_at);
      const dateLabel = sameDayLabel(date);
      if (dateLabel !== lastDate) {
        out.push({ kind: "divider", label: dateLabel });
        lastDate = dateLabel;
      }
      const prev = messages[i - 1];
      const next = messages[i + 1];
      const firstOfBurst = !prev || prev.sender_id !== m.sender_id || (date.getTime() - new Date(prev.created_at).getTime()) > 5 * 60_000;
      const showTail = !next || next.sender_id !== m.sender_id || (new Date(next.created_at).getTime() - date.getTime()) > 5 * 60_000;
      out.push({ kind: "msg", m, showTail, firstOfBurst });
    }
    return out;
  }, [messages]);

  const lastMineId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].sender_id === user?.id) return messages[i].id;
    }
    return null;
  }, [messages, user?.id]);

  // Soft-warning trigger: any message in this thread mentions a payment intent
  // (₹ / INR / UPI / GPay / Paytm / PayPal) AND the other party is an unverified rescuer.
  const PAYMENT_RE = /(₹|\brs\.?\b|\binr\b|\bupi\b|\bgpay\b|\bpaytm\b|\bpaypal\b)/i;
  const showRescuerWarning = useMemo(() => {
    if (!other) return false;
    if (warningDismissed) return false;
    if (other.accountType !== "rescuer") return false;
    if (other.orgApproved) return false;
    return messages.some((m) => m.body && PAYMENT_RE.test(m.body));
  }, [other, warningDismissed, messages]);

  const dismissWarning = () => {
    if (!convId) return;
    localStorage.setItem(`petos:rescuer-warn:${convId}`, "1");
    setWarningDismissed(true);
  };

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
                <div className="flex items-center gap-1.5">
                  <div className="font-medium leading-tight">{other.name}</div>
                  <UserStreakChip
                    userId={other.id}
                    className="text-[9px] py-0 px-1.5 h-4"
                  />
                </div>
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
              {other.accountType === "service_provider" && user?.id && (
                <LiveWalkChip
                  providerId={other.id}
                  customerId={user.id}
                  className="ml-2"
                />
              )}
            </div>
          )}
        </div>
      </header>

      <main ref={scrollRef} className="flex-1 overflow-y-auto container-app py-4 space-y-1">
        {showRescuerWarning && (
          <div className="my-2 rounded-2xl border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-3 flex gap-2 items-start">
            <ShieldAlert className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1 text-[12px] leading-relaxed text-amber-900 dark:text-amber-200">
              <strong>Heads-up:</strong> this account isn't KYC-verified yet. Avoid sending money outside Petos — meet the pet first and use Petos's protected payment flow.
            </div>
            <button onClick={dismissWarning} className="text-amber-700 hover:text-amber-900 p-0.5 shrink-0" aria-label="Dismiss">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
        {grouped.map((it, idx) => {
          if (it.kind === "divider") {
            return (
              <div key={`d-${idx}`} className="flex items-center justify-center my-3">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground bg-muted/60 px-2.5 py-1 rounded-full">
                  {it.label}
                </span>
              </div>
            );
          }
          const m = it.m;
          const mine = m.sender_id === user?.id;
          const isRead = mine && otherLastReadAt && new Date(otherLastReadAt) >= new Date(m.created_at);
          const showStatus = mine && m.id === lastMineId;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"} ${it.firstOfBurst ? "mt-2" : ""}`}>
              <div
                className={`max-w-[78%] px-3 py-2 text-sm whitespace-pre-wrap break-words ${
                  mine
                    ? `bg-primary text-primary-foreground rounded-2xl ${it.showTail ? "rounded-br-md" : ""}`
                    : `bg-muted rounded-2xl ${it.showTail ? "rounded-bl-md" : ""}`
                }`}
              >
                {m.attachment_url && m.attachment_kind === "image" && (
                  <a href={m.attachment_url} target="_blank" rel="noreferrer" className="block mb-1 -mx-1 -mt-1">
                    <img
                      src={m.attachment_url}
                      alt="attachment"
                      className="rounded-xl max-h-64 w-auto object-cover"
                      loading="lazy"
                    />
                  </a>
                )}
                {m.body && <Linkified text={m.body} mine={mine} />}
                {(it.showTail || showStatus) && (
                  <div className={`text-[10px] mt-0.5 flex items-center gap-1 ${mine ? "text-primary-foreground/70 justify-end" : "text-muted-foreground"}`}>
                    {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    {showStatus && (isRead ? <CheckCheck className="h-3 w-3" /> : <Check className="h-3 w-3" />)}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {otherTyping && (
          <div className="flex justify-start mt-2">
            <div className="px-3 py-2 rounded-2xl bg-muted flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
          </div>
        )}
      </main>

      <footer className="sticky bottom-0 bg-background border-t border-hairline">
        <div className="container-app py-3 space-y-2">
          {pendingImage && (
            <div className="relative inline-block">
              <img src={pendingImage} alt="" className="h-20 w-20 rounded-xl object-cover border border-hairline" />
              <button
                onClick={() => setPendingImage(null)}
                className="absolute -top-1.5 -right-1.5 h-6 w-6 rounded-full bg-foreground text-background grid place-items-center shadow"
                aria-label="Remove attachment"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
          <div className="flex gap-2 items-center">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => { const f = e.target.files?.[0]; if (f) pickImage(f); e.currentTarget.value = ""; }}
            />
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full shrink-0"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              aria-label="Attach image"
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
            </Button>
            <Input
              value={body}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="Message…"
              className="rounded-full"
            />
            <Button onClick={send} disabled={sending || (!body.trim() && !pendingImage)} size="icon" className="rounded-full">
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </footer>
    </div>
  );
}

function sameDayLabel(d: Date) {
  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startOfDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((startOfToday.getTime() - startOfDate.getTime()) / 86_400_000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return d.toLocaleDateString([], { weekday: "long" });
  return d.toLocaleDateString([], { day: "numeric", month: "short", year: d.getFullYear() === today.getFullYear() ? undefined : "numeric" });
}

function Linkified({ text, mine }: { text: string; mine: boolean }) {
  const parts = text.split(/(https?:\/\/[^\s]+)/g);
  return (
    <>
      {parts.map((p, i) =>
        /^https?:\/\//.test(p) ? (
          <a
            key={i}
            href={p}
            target="_blank"
            rel="noreferrer"
            className={`underline ${mine ? "text-primary-foreground" : "text-foreground"}`}
            onClick={(e) => e.stopPropagation()}
          >
            {p}
          </a>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}
