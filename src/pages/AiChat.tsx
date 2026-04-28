import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Sparkles, Send, Loader2, ChevronDown } from "lucide-react";
import { usePets } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { TierGate } from "@/components/TierGate";
import { useTier } from "@/hooks/useTier";
import { useAuth } from "@/hooks/useAuth";

type Msg = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "Build a daily meal plan",
  "He's been scratching a lot",
  "When is the next vaccine due?",
  "Tips for crate training",
];

const AiChat = () => {
  const nav = useNavigate();
  const { user } = useAuth();
  const { data: tier } = useTier();
  const { data: pets } = usePets();
  const [activePetId, setActivePetId] = useState<string | undefined>();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [softGate, setSoftGate] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!activePetId && pets?.[0]) setActivePetId(pets[0].id);
  }, [pets, activePetId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, streaming]);

  const activePet = pets?.find((p) => p.id === activePetId);

  const send = async (raw: string) => {
    const text = raw.trim();
    if (!text || streaming) return;
    const next: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setStreaming(true);

    let assistantSoFar = "";
    const upsert = (chunk: string) => {
      assistantSoFar += chunk;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") {
          return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m));
        }
        return [...prev, { role: "assistant", content: assistantSoFar }];
      });
    };

    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) throw new Error("Please sign in again");

      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ messages: next, petId: activePetId, mode: "chat" }),
      });

      if (resp.status === 429) { toast.error("Slow down a moment — try again shortly."); throw new Error("rate"); }
      if (resp.status === 402) { toast.error("AI credits exhausted. Add credits in workspace settings."); throw new Error("payment"); }
      if (!resp.ok || !resp.body) throw new Error("AI assistant unavailable");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let done = false;
      while (!done) {
        const { done: rDone, value } = await reader.read();
        if (rDone) break;
        buf += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) !== -1) {
          let line = buf.slice(0, nl);
          buf = buf.slice(nl + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") { done = true; break; }
          try {
            const parsed = JSON.parse(json);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) upsert(content);
          } catch {
            buf = line + "\n" + buf;
            break;
          }
        }
      }
      if (buf.trim()) {
        for (let raw of buf.split("\n")) {
          if (raw.endsWith("\r")) raw = raw.slice(0, -1);
          if (!raw.startsWith("data: ")) continue;
          const json = raw.slice(6).trim();
          if (json === "[DONE]") continue;
          try {
            const parsed = JSON.parse(json);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) upsert(content);
          } catch { /* ignore */ }
        }
      }
    } catch (e: any) {
      if (!["rate", "payment"].includes(e?.message)) toast.error(e?.message ?? "Something went wrong");
      // Roll back the empty assistant placeholder if no tokens arrived
      if (!assistantSoFar) setMessages(next);
    } finally {
      setStreaming(false);
    }

    // Soft-gate: free users see Plus prompt once after their 3rd chat in 30d.
    if (tier?.tier === "free" && user?.id) {
      try {
        const seenKey = `petos_plus_softgate_${user.id}`;
        const lastShown = localStorage.getItem(seenKey);
        const monthAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
        if (!lastShown || Number(lastShown) < monthAgo) {
          const since = new Date(monthAgo).toISOString().slice(0, 10);
          const { data: rows } = await supabase
            .from("usage_counters")
            .select("count")
            .eq("user_id", user.id)
            .eq("kind", "ai_chat")
            .gte("period", since);
          const total = (rows ?? []).reduce((s, r: any) => s + (r.count ?? 0), 0);
          if (total >= 3) {
            setSoftGate(true);
            localStorage.setItem(seenKey, String(Date.now()));
          }
        }
      } catch { /* ignore */ }
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="container-app pad-top-safe pt-4 pb-3 flex items-center gap-3 border-b border-hairline">
        <Button variant="ghost" size="icon" onClick={() => nav(-1)} className="rounded-full">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="font-display text-lg leading-tight">AI assistant</div>
          <div className="text-xs text-muted-foreground">Personalised to your pet's vault</div>
        </div>
        {pets && pets.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="rounded-full gap-1.5 border-hairline">
                <span className="max-w-[100px] truncate">{activePet?.name ?? "Select pet"}</span>
                <ChevronDown className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {pets.map((p) => (
                <DropdownMenuItem key={p.id} onClick={() => setActivePetId(p.id)}>{p.name}</DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto container-app py-5">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center text-center pt-8">
            <div className="bg-primary-soft rounded-full p-4 mb-4">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
            <div className="font-display text-2xl">Ask anything about {activePet?.name ?? "your pet"}</div>
            <p className="text-sm text-muted-foreground mt-2 max-w-xs">
              Diet, behaviour, vaccines, symptoms — grounded in your vault.
            </p>
            <div className="mt-6 grid grid-cols-1 gap-2 w-full max-w-sm">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="text-sm text-left px-4 py-3 rounded-xl border border-hairline bg-card hover:bg-muted/40 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    m.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-md"
                      : "bg-card border border-hairline rounded-bl-md"
                  }`}
                >
                  {m.role === "assistant" ? (
                    <div className="prose prose-sm max-w-none prose-p:my-2 prose-ul:my-2 prose-li:my-0.5 prose-headings:font-display">
                      <ReactMarkdown>{m.content || "…"}</ReactMarkdown>
                    </div>
                  ) : (
                    <div className="whitespace-pre-wrap">{m.content}</div>
                  )}
                </div>
              </div>
            ))}
            {streaming && messages[messages.length - 1]?.role === "user" && (
              <div className="flex justify-start">
                <div className="bg-card border border-hairline rounded-2xl rounded-bl-md px-4 py-3">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="border-t border-hairline bg-background container-app py-3 pad-bottom-safe">
        <form
          onSubmit={(e) => { e.preventDefault(); send(input); }}
          className="flex gap-2 items-end"
        >
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); }
            }}
            placeholder={`Message about ${activePet?.name ?? "your pet"}…`}
            rows={1}
            className="rounded-2xl border-hairline resize-none min-h-[44px] max-h-32 py-3"
            disabled={streaming}
          />
          <Button type="submit" size="icon" className="rounded-full h-11 w-11 shrink-0" disabled={streaming || !input.trim()}>
            {streaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </form>
      </div>

      <TierGate
        open={softGate}
        onOpenChange={setSoftGate}
        feature="Loving DogtorAI?"
        reason="Plus gives unlimited chats, vet consults, and more — at one price."
      />
    </div>
  );
};

export default AiChat;
