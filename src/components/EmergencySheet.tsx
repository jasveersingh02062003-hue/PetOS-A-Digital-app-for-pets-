import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Siren, MessageSquare, Stethoscope, Loader2, AlertTriangle, CheckCircle2, Phone } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { usePets, useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { PaywallSheet } from "@/components/PaywallSheet";

type Triage = {
  severity: "mild" | "moderate" | "severe";
  summary: string;
  recommend_vet: boolean;
  home_care?: string[];
};

export const EmergencySheet = ({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) => {
  const nav = useNavigate();
  const { data: pets } = usePets();
  const { data: profile } = useProfile();
  const emergencyVet = (profile as any)?.emergency_vet ?? null;
  const [petId, setPetId] = useState<string | undefined>();
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [triage, setTriage] = useState<Triage | null>(null);
  const [creating, setCreating] = useState(false);
  const [paywallOpen, setPaywallOpen] = useState(false);

  useEffect(() => {
    if (!petId && pets?.[0]) setPetId(pets[0].id);
  }, [pets, petId]);

  useEffect(() => {
    if (!open) { setText(""); setTriage(null); }
  }, [open]);

  const runTriage = async () => {
    if (!text.trim()) return toast.error("Tell us what's happening first");
    setLoading(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) throw new Error("Please sign in again");
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          messages: [{ role: "user", content: text }],
          petId,
          mode: "triage",
        }),
      });
      if (resp.status === 429) throw new Error("Slow down a moment — try again shortly.");
      if (resp.status === 402) throw new Error("AI credits exhausted.");
      if (!resp.ok) throw new Error("Triage unavailable");
      const json = await resp.json();
      if (!json.triage) throw new Error("Could not classify — try rephrasing");
      setTriage(json.triage);
    } catch (e: any) {
      toast.error(e?.message ?? "Triage failed");
    } finally {
      setLoading(false);
    }
  };

  const startConnectVet = () => {
    if (!triage || !petId) return;
    setPaywallOpen(true);
  };

  const finishConnectVet = async () => {
    if (!triage || !petId) return;
    setCreating(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Please sign in again");
      const { data, error } = await supabase
        .from("vet_consults")
        .insert({
          pet_id: petId,
          owner_id: u.user.id,
          severity: triage.severity,
          ai_summary: triage.summary,
        })
        .select("id")
        .single();
      if (error) throw error;
      onOpenChange(false);
      nav(`/vet/consult/${data.id}`);
    } catch (e: any) {
      toast.error(e?.message ?? "Could not start consult");
    } finally {
      setCreating(false);
    }
  };

  const sevTone = (s: Triage["severity"]) =>
    s === "severe" ? "bg-emergency/10 text-emergency border-emergency/30"
    : s === "moderate" ? "bg-amber-500/10 text-amber-700 border-amber-500/30 dark:text-amber-300"
    : "bg-primary-soft text-primary border-primary/20";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl border-hairline max-h-[92vh] overflow-y-auto">
        <SheetHeader className="text-left">
          <div className="flex items-center gap-3 mb-1">
            <div className="bg-emergency/10 rounded-full p-2">
              <Siren className="h-5 w-5 text-emergency" strokeWidth={1.75} />
            </div>
            <SheetTitle className="font-display text-2xl">Emergency triage</SheetTitle>
          </div>
          <p className="text-sm text-muted-foreground">
            Quick AI assessment — connect to a vet if needed. {pets?.length ? `For ${pets.find(p => p.id === petId)?.name ?? pets[0].name}.` : ""}
          </p>
        </SheetHeader>

        {!triage ? (
          <div className="mt-5 space-y-3 pb-6">
            {pets && pets.length > 1 && (
              <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1">
                {pets.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setPetId(p.id)}
                    className={`shrink-0 px-3 py-1.5 rounded-full text-xs border transition-colors ${
                      petId === p.id ? "bg-primary text-primary-foreground border-primary" : "bg-card border-hairline"
                    }`}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            )}
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="What's happening? e.g. vomited 3 times in last hour, won't eat, very lethargic…"
              rows={4}
              className="rounded-2xl border-hairline"
              disabled={loading}
            />
            {emergencyVet?.phone && (
              <a href={`tel:${emergencyVet.phone}`} className="block">
                <Button variant="default" size="lg" className="w-full h-12 rounded-2xl gap-2 bg-emergency hover:bg-emergency/90 text-emergency-foreground">
                  <Phone className="h-4 w-4" /> Call {emergencyVet.name || "your vet"}
                </Button>
              </a>
            )}
            <Button onClick={runTriage} disabled={loading || !pets?.length} size="lg" className="w-full rounded-2xl h-12">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Assess now</>}
            </Button>
            <Button
              variant="outline"
              onClick={() => { onOpenChange(false); nav("/ai"); }}
              className="w-full h-12 rounded-2xl gap-2 border-hairline"
            >
              <MessageSquare className="h-4 w-4" /> Open full AI chat
            </Button>
          </div>
        ) : (
          <div className="mt-5 space-y-4 pb-6">
            <div className={`rounded-2xl border p-4 ${sevTone(triage.severity)}`}>
              <div className="flex items-center gap-2 font-display text-lg capitalize">
                {triage.severity === "severe" ? <AlertTriangle className="h-5 w-5" /> : triage.severity === "moderate" ? <AlertTriangle className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
                {triage.severity} severity
              </div>
              <p className="text-sm mt-2 leading-relaxed text-foreground/90">{triage.summary}</p>
            </div>

            {triage.home_care && triage.home_care.length > 0 && (
              <div className="rounded-2xl border border-hairline bg-card p-4">
                <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Immediate steps</div>
                <ul className="space-y-1.5 text-sm">
                  {triage.home_care.map((s, i) => (
                    <li key={i} className="flex gap-2"><span className="text-primary">•</span><span>{s}</span></li>
                  ))}
                </ul>
              </div>
            )}

            {triage.recommend_vet || triage.severity !== "mild" ? (
              <Button onClick={startConnectVet} disabled={creating} size="lg" className="w-full rounded-2xl h-14 gap-3 justify-start">
                <Stethoscope className="h-5 w-5" />
                <div className="text-left">
                  <div className="font-medium">Connect to a vet</div>
                  <div className="text-xs opacity-80">Sends this summary to first available vet</div>
                </div>
                {creating && <Loader2 className="h-4 w-4 animate-spin ml-auto" />}
              </Button>
            ) : (
              <Button
                onClick={() => { onOpenChange(false); nav("/ai"); }}
                size="lg"
                className="w-full rounded-2xl h-14 gap-3 justify-start"
              >
                <MessageSquare className="h-5 w-5" />
                <div className="text-left">
                  <div className="font-medium">Continue in AI chat</div>
                  <div className="text-xs opacity-80">Get follow-up tips and tracking</div>
                </div>
              </Button>
            )}

            <Button variant="ghost" onClick={() => setTriage(null)} className="w-full">Reassess</Button>
          </div>
        )}
      </SheetContent>
      <PaywallSheet
        open={paywallOpen}
        onOpenChange={setPaywallOpen}
        kind="vet_consult"
        onConfirmed={finishConnectVet}
      />
    </Sheet>
  );
};
