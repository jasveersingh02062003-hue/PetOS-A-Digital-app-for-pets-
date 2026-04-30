import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Camera, Loader2, Sparkles, AlertTriangle, Stethoscope, Dog } from "lucide-react";
import { toast } from "sonner";
import { MedicalDisclaimer } from "@/components/MedicalDisclaimer";

type Mode = "skin" | "breed" | "general";

type SkinResult = {
  severity: "none" | "mild" | "moderate" | "severe";
  findings: string[];
  possible_causes?: string[];
  home_care?: string[];
  recommend_vet: boolean;
  confidence: "low" | "medium" | "high";
};
type BreedResult = {
  species_guess: "dog" | "cat" | "other" | "unknown";
  top_breeds: { breed: string; confidence_pct: number }[];
  notes?: string;
};
type GeneralResult = {
  mood: string;
  posture?: string;
  observations: string[];
  recommend_vet: boolean;
};

type AnalysisResult =
  | { mode: "skin"; result: SkinResult }
  | { mode: "breed"; result: BreedResult }
  | { mode: "general"; result: GeneralResult };

export default function PhotoVet() {
  const nav = useNavigate();
  const { user } = useAuth();
  const [mode, setMode] = useState<Mode>("skin");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = (f: File | null) => {
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) return toast.error("Image must be under 5 MB");
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setAnalysis(null);
  };

  const fileToBase64 = (f: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const r = reader.result as string;
        resolve(r.split(",")[1] ?? "");
      };
      reader.onerror = reject;
      reader.readAsDataURL(f);
    });

  const analyze = async () => {
    if (!user) return toast.error("Please sign in");
    if (!file) return toast.error("Add a photo first");
    setLoading(true);
    setAnalysis(null);
    try {
      const image_base64 = await fileToBase64(file);
      const { data, error } = await supabase.functions.invoke("ai-photo-analyze", {
        body: { mode, image_base64, note: note.trim() || undefined },
      });
      if (error) throw error;
      if (data?.error) {
        if (data.code === "tier_limit") {
          toast.error("Free limit reached. Upgrade to Plus for unlimited photo analyses.");
        } else {
          toast.error(data.error);
        }
        return;
      }
      setAnalysis(data as AnalysisResult);
    } catch (e: any) {
      toast.error(e?.message ?? "Analysis failed");
    } finally {
      setLoading(false);
    }
  };

  const askAVet = async () => {
    if (!user || !analysis) return;
    try {
      let summary = "";
      if (analysis.mode === "skin") {
        summary = `AI skin scan (${analysis.result.severity}, confidence ${analysis.result.confidence}).\nFindings: ${analysis.result.findings.join("; ")}.\n${analysis.result.possible_causes?.length ? `Possible causes: ${analysis.result.possible_causes.join("; ")}.` : ""}\n${note ? `Owner note: ${note}` : ""}`;
      } else if (analysis.mode === "general") {
        summary = `AI general scan. Mood: ${analysis.result.mood}. ${analysis.result.observations.join("; ")}.\n${note ? `Owner note: ${note}` : ""}`;
      } else {
        summary = `Breed guess: ${analysis.result.top_breeds.map((b) => `${b.breed} (${b.confidence_pct}%)`).join(", ")}.`;
      }
      const { data, error } = await supabase
        .from("vet_questions")
        .insert({
          asker_id: user.id,
          title: `Photo review — ${mode}`,
          body: summary,
          category: "general" as any,
          source: "ai_handoff",
        } as any)
        .select("id")
        .single();
      if (error) throw error;
      toast.success("Sent to a vet");
      nav(`/askvet/${data.id}`);
    } catch (e: any) {
      toast.error(e.message ?? "Could not send");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="container-app pad-top-safe pt-4 pb-3 flex items-center gap-3 border-b border-hairline">
        <Button variant="ghost" size="icon" onClick={() => nav(-1)} className="rounded-full">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="font-display text-lg leading-tight">Photo vet</div>
          <div className="text-xs text-muted-foreground">AI scans pet photos for skin, breed & mood</div>
        </div>
        <Sparkles className="h-5 w-5 text-primary" />
      </header>

      <div className="container-app py-4 space-y-4">
        <MedicalDisclaimer />

        <Tabs value={mode} onValueChange={(v) => { setMode(v as Mode); setAnalysis(null); }}>
          <TabsList className="grid grid-cols-3 w-full rounded-full bg-muted/40 p-1">
            <TabsTrigger value="skin" className="rounded-full text-xs">Skin / coat</TabsTrigger>
            <TabsTrigger value="breed" className="rounded-full text-xs">Breed</TabsTrigger>
            <TabsTrigger value="general" className="rounded-full text-xs">Mood</TabsTrigger>
          </TabsList>
        </Tabs>

        <Card className="rounded-2xl border-hairline overflow-hidden">
          {preview ? (
            <div className="relative bg-muted">
              <img src={preview} alt="preview" className="w-full max-h-80 object-contain" loading="lazy" decoding="async" />
              <button
                onClick={() => { setFile(null); setPreview(null); setAnalysis(null); }}
                className="absolute top-3 right-3 px-3 py-1.5 rounded-full bg-background/90 text-xs"
              >
                Replace
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="w-full aspect-[4/3] flex flex-col items-center justify-center text-muted-foreground gap-2 hover:bg-muted/30 transition-colors"
            >
              <div className="bg-primary-soft rounded-full p-4">
                <Camera className="h-6 w-6 text-primary" />
              </div>
              <div className="font-medium text-foreground">Add a clear photo</div>
              <div className="text-xs">Good light, close-up, no filters</div>
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => onFile(e.target.files?.[0] ?? null)}
          />
        </Card>

        {mode !== "breed" && (
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={mode === "skin" ? "Optional: where on the body? since when?" : "Optional: any context for the AI?"}
            maxLength={300}
            className="rounded-xl border-hairline resize-none min-h-[70px]"
          />
        )}

        <Button onClick={analyze} disabled={!file || loading} size="lg" className="w-full rounded-xl">
          {loading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Analysing…</> : <><Sparkles className="h-4 w-4 mr-2" /> Analyse photo</>}
        </Button>

        {analysis && <ResultCard analysis={analysis} onAskVet={askAVet} />}
      </div>
    </div>
  );
}

function ResultCard({ analysis, onAskVet }: { analysis: AnalysisResult; onAskVet: () => void }) {
  if (analysis.mode === "skin") {
    const r = analysis.result;
    const sevColor =
      r.severity === "severe" ? "destructive" :
      r.severity === "moderate" ? "default" :
      r.severity === "mild" ? "secondary" : "outline";
    return (
      <Card className="rounded-2xl border-hairline p-4 space-y-3 animate-in fade-in slide-in-from-bottom-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant={sevColor as any} className="rounded-full capitalize">{r.severity}</Badge>
          <Badge variant="outline" className="rounded-full text-xs">Confidence: {r.confidence}</Badge>
        </div>
        {r.findings.length > 0 && (
          <div>
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">Findings</div>
            <ul className="text-sm space-y-1">
              {r.findings.map((f, i) => <li key={i} className="flex gap-2"><span className="text-primary">•</span>{f}</li>)}
            </ul>
          </div>
        )}
        {r.possible_causes && r.possible_causes.length > 0 && (
          <div>
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">Possible causes</div>
            <div className="flex flex-wrap gap-1.5">
              {r.possible_causes.map((c, i) => <Badge key={i} variant="secondary" className="rounded-full font-normal">{c}</Badge>)}
            </div>
          </div>
        )}
        {r.home_care && r.home_care.length > 0 && (
          <div>
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">Home care</div>
            <ul className="text-sm space-y-1">
              {r.home_care.map((c, i) => <li key={i} className="flex gap-2"><span className="text-primary">→</span>{c}</li>)}
            </ul>
          </div>
        )}
        {r.recommend_vet && (
          <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-3 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
            <div className="text-sm">
              <div className="font-medium">Vet visit recommended</div>
              <div className="text-xs text-muted-foreground">A vet should examine this in person.</div>
            </div>
          </div>
        )}
        <Button onClick={onAskVet} variant="outline" className="w-full rounded-full gap-2">
          <Stethoscope className="h-4 w-4" /> Send to a vet
        </Button>
      </Card>
    );
  }

  if (analysis.mode === "breed") {
    const r = analysis.result;
    return (
      <Card className="rounded-2xl border-hairline p-4 space-y-3 animate-in fade-in slide-in-from-bottom-2">
        <div className="flex items-center gap-2">
          <Dog className="h-4 w-4 text-primary" />
          <div className="text-sm font-medium capitalize">{r.species_guess}</div>
        </div>
        <div className="space-y-2">
          {r.top_breeds.map((b, i) => (
            <div key={i} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{b.breed}</span>
                <span className="text-muted-foreground">{Math.round(b.confidence_pct)}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-primary rounded-full" style={{ width: `${Math.min(100, b.confidence_pct)}%` }} />
              </div>
            </div>
          ))}
        </div>
        {r.notes && <p className="text-xs text-muted-foreground italic">{r.notes}</p>}
      </Card>
    );
  }

  const r = analysis.result;
  return (
    <Card className="rounded-2xl border-hairline p-4 space-y-3 animate-in fade-in slide-in-from-bottom-2">
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant="secondary" className="rounded-full capitalize">{r.mood}</Badge>
        {r.posture && <Badge variant="outline" className="rounded-full">{r.posture}</Badge>}
      </div>
      <ul className="text-sm space-y-1">
        {r.observations.map((o, i) => <li key={i} className="flex gap-2"><span className="text-primary">•</span>{o}</li>)}
      </ul>
      {r.recommend_vet && (
        <Button onClick={onAskVet} variant="outline" className="w-full rounded-full gap-2">
          <Stethoscope className="h-4 w-4" /> Send to a vet
        </Button>
      )}
    </Card>
  );
}
