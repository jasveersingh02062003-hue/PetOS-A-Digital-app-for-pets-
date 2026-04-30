import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import {
  ArrowLeft, Send, Loader2, ChevronDown, Stethoscope, Siren, ShieldAlert, AlertCircle, CheckCircle2,
} from "lucide-react";
import { usePets } from "@/hooks/useProfile";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MedicalDisclaimer } from "@/components/MedicalDisclaimer";
import { useSeo } from "@/hooks/useSeo";
import { NearestVetCta } from "@/components/vet/NearestVetCta";

type Msg = { role: "user" | "assistant"; content: string };
type Severity = "mild" | "moderate" | "severe";
type Triage = {
  severity: Severity;
  summary: string;
  recommend_vet: boolean;
  home_care?: string[];
};

const QUICK_PROMPTS = [
  "He's vomiting white foam",
  "She had a seizure 5 minutes ago",
  "Bleeding from paw",
  "Suddenly lethargic and not eating",
];

const SEVERITY_TONE: Record<Severity, { bg: string; text: string; ring: string; icon: any; label: string }> = {
  mild:     { bg: "bg-leaf/10",      text: "text-leaf",      ring: "ring-leaf/30",      icon: CheckCircle2, label: "Mild — monitor at home" },
  moderate: { bg: "bg-amber/15",     text: "text-amber",     ring: "ring-amber/30",     icon: AlertCircle,  label: "Moderate — vet today" },
  severe:   { bg: "bg-emergency/12", text: "text-emergency", ring: "ring-emergency/30", icon: ShieldAlert,  label: "Severe — see a vet now" },
};

const VetTriage = () => {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const { user } = useAuth();
  const { data: pets } = usePets();

  const [activePetId, setActivePetId] = useState<string | undefined>(params.get("pet") || undefined);
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [classifying, setClassifying] = useState(false);
  const [triage, setTriage] = useState<Triage | null>(null);
  const [escalating, setEscalating] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useSeo({ title: "Emergency vet triage", description: "Talk to PetOS AI Doctor — instant triage for your pet." });

  useEffect(() => {
    if (!activePetId && pets?.[0]) setActivePetId(pets[0].id);
  }, [pets, activePetId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, streaming, triage]);

  const activePet = pets?.find((p) => p.id === activePetId);

  // Lazily create a session when the user sends their first message
  const ensureSession = async (): Promise<string | undefined> => {
    if (sessionId || !user) return sessionId;
    const { data, error } = await supabase
      .from("vet_triage_sessions")
      .insert({ owner_id: user.id, pet_id: activePetId ?? null })
      .select("id")
      .single();
    if (error) {
      console.error(error);
      return undefined;
    }
    setSessionId(data.id);
    return data.id;
  };

  const send = async (raw: string) => {
    const text = raw.trim();
    if (!text || streaming) return;
    const sid = await ensureSession();
    const next: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setStreaming(true);
    setTriage(null);

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
      if (resp.status === 429) { toast.error("Too many requests — slow down a moment."); throw new Error("rate"); }
      if (resp.status === 402) { toast.error("AI credits exhausted. Add credits in Settings → Workspace."); throw new Error("payment"); }
      if (!resp.ok || !resp.body) throw new Error("AI assistant unavailable");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = ""; let done = false;
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
    } catch (e: any) {
      if (!["rate", "payment"].includes(e?.message)) toast.error(e?.message ?? "Something went wrong");
      if (!assistantSoFar) setMessages(next);
    } finally {
      setStreaming(false);
    }

    // After at least one user+assistant exchange, ask the model to classify severity
    const finalMsgs: Msg[] = [...next, { role: "assistant", content: assistantSoFar }];
    if (assistantSoFar && sid) classify(finalMsgs, sid);
  };

  const classify = async (msgs: Msg[], sid: string) => {
    setClassifying(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) return;
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ messages: msgs, petId: activePetId, mode: "triage", triageSessionId: sid }),
      });
      if (!resp.ok) return;
      const json = await resp.json();
      if (json?.triage) setTriage(json.triage as Triage);
    } catch (e) {
      console.error("triage classify failed", e);
    } finally {
      setClassifying(false);
    }
  };

  const escalateToVet = async (): Promise<void> => {
    if (!sessionId || !activePetId) {
      toast.error("Pick a pet first");
      return;
    }
    nav(`/book-vet?pet=${activePetId}&triage=${sessionId}`);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Emergency header — distinct from regular AI chat */}
      <header className="container-app pad-top-safe pt-4 pb-3 flex items-center gap-3 border-b border-hairline">
        <Button variant="ghost" size="icon" onClick={() => nav(-1)} className="rounded-full">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="h-9 w-9 rounded-2xl bg-emergency/12 ring-1 ring-emergency/25 flex items-center justify-center">
          <Siren className="h-5 w-5 text-emergency" strokeWidth={2.2} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-display text-lg leading-tight">DogtorAI</div>
          <div className="text-[11px] text-muted-foreground">Emergency triage · pet-context aware</div>
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

      <div className="container-app pt-3"><MedicalDisclaimer /></div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto container-app py-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center text-center pt-6">
            <div className="bg-emergency/10 rounded-full p-4 mb-4 ring-1 ring-emergency/20">
              <Siren className="h-7 w-7 text-emergency" />
            </div>
            <div className="font-display text-2xl">What's happening with {activePet?.name ?? "your pet"}?</div>
            <p className="text-sm text-muted-foreground mt-2 max-w-sm">
              Describe symptoms in your own words. I already know {activePet?.name ?? "your pet"}'s breed, age, weight, vaccines and recent records.
            </p>
            <div className="mt-6 grid grid-cols-1 gap-2 w-full max-w-sm">
              {QUICK_PROMPTS.map((s) => (
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
                <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  m.role === "user"
                    ? "bg-primary text-primary-foreground rounded-br-md"
                    : "bg-card border border-hairline rounded-bl-md"
                }`}>
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

            {classifying && !triage && (
              <div className="text-[11px] text-muted-foreground text-center">Assessing severity…</div>
            )}

            {triage && <TriageVerdict triage={triage} onEscalate={escalateToVet} escalating={escalating} setEscalating={setEscalating} />}
          </div>
        )}
      </div>

      <div className="border-t border-hairline bg-background container-app py-3 pad-bottom-safe">
        <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="flex gap-2 items-end">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); }
            }}
            placeholder={`Describe symptoms for ${activePet?.name ?? "your pet"}…`}
            rows={1}
            className="rounded-2xl border-hairline resize-none min-h-[44px] max-h-32 py-3"
            disabled={streaming}
          />
          <Button type="submit" size="icon" className="rounded-full h-11 w-11 shrink-0" disabled={streaming || !input.trim()}>
            {streaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </form>
      </div>
    </div>
  );
};

const TriageVerdict = ({
  triage, onEscalate, escalating, setEscalating,
}: {
  triage: Triage; onEscalate: () => Promise<void>;
  escalating: boolean; setEscalating: (b: boolean) => void;
}) => {
  const tone = SEVERITY_TONE[triage.severity];
  const Icon = tone.icon;
  return (
    <Card className={`rounded-2xl border-hairline p-4 ring-1 ${tone.ring} ${tone.bg} mt-4`}>
      <div className={`flex items-center gap-2 ${tone.text} font-semibold text-sm`}>
        <Icon className="h-4 w-4" /> {tone.label}
      </div>
      {triage.summary && (
        <p className="text-sm text-foreground mt-2 leading-relaxed">{triage.summary}</p>
      )}
      {!!triage.home_care?.length && (
        <ul className="mt-3 space-y-1.5">
          {triage.home_care.map((h, i) => (
            <li key={i} className="text-xs text-foreground/80 flex gap-2">
              <span className="text-foreground/40">{i + 1}.</span><span>{h}</span>
            </li>
          ))}
        </ul>
      )}
      {triage.recommend_vet && (
        <Button
          onClick={async () => { setEscalating(true); try { await onEscalate(); } finally { setEscalating(false); } }}
          disabled={escalating}
          className="w-full mt-4 rounded-full h-11 bg-emergency text-emergency-foreground hover:bg-emergency/90"
        >
          {escalating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Stethoscope className="h-4 w-4 mr-2" />}
          Talk to a vet now
        </Button>
      )}
      {(triage.severity === "moderate" || triage.severity === "severe") && (
        <div className="mt-4">
          <NearestVetCta />
        </div>
      )}
    </Card>
  );
};

export default VetTriage;
