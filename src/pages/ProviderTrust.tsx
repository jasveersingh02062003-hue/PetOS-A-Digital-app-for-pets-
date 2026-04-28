import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ArrowLeft, ShieldCheck, Upload, Loader2, FileCheck2, GraduationCap } from "lucide-react";
import { toast } from "sonner";
import { TrustBadge } from "@/components/services/TrustBadge";

type Question = {
  q: string;
  options: string[];
  correct: number;
};

const QUIZ: Question[] = [
  {
    q: "A dog you're walking suddenly limps and refuses to put weight on a paw. What's your FIRST step?",
    options: [
      "Carry on slowly so it doesn't lose the routine",
      "Stop the walk, check for visible injury, and contact the owner immediately",
      "Give it a treat to distract it and keep walking",
      "Wait until the end of the walk and mention it",
    ],
    correct: 1,
  },
  {
    q: "What's the safest way to break up a fight between two dogs?",
    options: [
      "Grab both collars and pull",
      "Shout and reach between them",
      "Use a loud distraction (water spray, loud noise) — never put your hands between them",
      "Pick up the smaller dog by the scruff",
    ],
    correct: 2,
  },
  {
    q: "Which of these is NOT safe for a dog to eat?",
    options: ["Carrots", "Plain boiled chicken", "Grapes", "Cooked rice"],
    correct: 2,
  },
  {
    q: "It's 38°C outside. You're booked for a 1-hour walk. What do you do?",
    options: [
      "Walk normally — the dog needs exercise",
      "Reschedule to early morning or evening, or replace with indoor play and update the owner",
      "Walk on the road since the pavement is the same temperature",
      "Walk only puppies and seniors",
    ],
    correct: 1,
  },
  {
    q: "An owner asks you not to use a retractable leash. The dog is pulling hard. You should:",
    options: [
      "Use a retractable anyway, it's safer for you",
      "Respect the owner's instruction and use the leash they provided",
      "Take the dog off-leash in a quiet street",
      "Cancel the booking",
    ],
    correct: 1,
  },
];

const PASS_THRESHOLD = 4; // out of 5

const ProviderTrust = () => {
  const { providerId } = useParams<{ providerId: string }>();
  const nav = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: provider, refetch } = useQuery({
    queryKey: ["provider-trust", providerId],
    enabled: !!providerId && !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_providers")
        .select("*")
        .eq("id", providerId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // ---- Document uploads ----
  const idRef = useRef<HTMLInputElement>(null);
  const addrRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<"id" | "addr" | null>(null);

  const uploadDoc = async (file: File, kind: "id" | "addr") => {
    if (!user || !providerId) return;
    if (file.size > 10 * 1024 * 1024) return toast.error("Max 10 MB");
    setUploading(kind);
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${user.id}/${providerId}/${kind}-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("trust-docs").upload(path, file, { upsert: true });
    if (upErr) { setUploading(null); return toast.error(upErr.message); }
    const field = kind === "id" ? "id_proof_path" : "address_proof_path";
    const patch: any = { [field]: path };
    // First upload moves status to pending
    if (provider?.trust_status === "none") patch.trust_status = "pending";
    const { error } = await supabase.from("service_providers").update(patch).eq("id", providerId);
    setUploading(null);
    if (error) return toast.error(error.message);
    toast.success("Uploaded — admins will review.");
    refetch();
    qc.invalidateQueries({ queryKey: ["my-providers"] });
  };

  // ---- Quiz state ----
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const allAnswered = Object.keys(answers).length === QUIZ.length;

  const submitQuiz = async () => {
    if (!user || !providerId) return;
    if (!allAnswered) return toast.error("Answer all questions first");
    let score = 0;
    QUIZ.forEach((q, i) => { if (answers[i] === q.correct) score += 1; });
    const passed = score >= PASS_THRESHOLD;
    setSubmitting(true);
    const { error } = await supabase.from("provider_quiz_attempts").insert({
      provider_id: providerId,
      user_id: user.id,
      score,
      total: QUIZ.length,
      passed,
      answers,
    });
    setSubmitting(false);
    if (error) return toast.error(error.message);
    if (passed) {
      toast.success(`Passed ${score}/${QUIZ.length} — safety badge unlocked!`);
    } else {
      toast.error(`Scored ${score}/${QUIZ.length}. You need ${PASS_THRESHOLD} to pass — try again.`);
    }
    setAnswers({});
    refetch();
    qc.invalidateQueries({ queryKey: ["my-providers"] });
  };

  if (!provider) {
    return <div className="container-app py-10 text-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></div>;
  }

  const quizPassed = !!provider.quiz_passed_at;

  return (
    <div className="min-h-screen bg-background">
      <header className="container-app pad-top-safe pt-4 pb-3 flex items-center gap-3 border-b border-hairline">
        <Button variant="ghost" size="icon" onClick={() => nav(-1)} className="rounded-full">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="font-display text-lg leading-tight truncate">{provider.name}</div>
          <div className="text-xs text-muted-foreground">Build trust with customers</div>
        </div>
        <TrustBadge provider={provider as any} />
      </header>

      <div className="container-app py-5 space-y-5 pb-12">
        {/* ID Verification */}
        <Card className="rounded-2xl border-hairline p-5 space-y-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <div className="font-display text-lg">ID verification</div>
          </div>
          <p className="text-sm text-muted-foreground">
            Upload a government photo ID and a recent address proof. Admins review within 48 hours. Documents are private — only you and admins can view them.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <DocSlot
              label="Photo ID (Aadhaar / PAN / DL)"
              uploaded={!!provider.id_proof_path}
              loading={uploading === "id"}
              onPick={() => idRef.current?.click()}
            />
            <DocSlot
              label="Address proof (utility bill, bank statement)"
              uploaded={!!provider.address_proof_path}
              loading={uploading === "addr"}
              onPick={() => addrRef.current?.click()}
            />
          </div>

          <input ref={idRef} type="file" accept="image/*,application/pdf" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadDoc(f, "id"); e.currentTarget.value = ""; }} />
          <input ref={addrRef} type="file" accept="image/*,application/pdf" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadDoc(f, "addr"); e.currentTarget.value = ""; }} />

          <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
            <span>Status:</span>
            <span className="font-medium capitalize">{provider.trust_status?.replace("_", " ") || "none"}</span>
          </div>
        </Card>

        {/* Years experience */}
        <YearsExperienceCard providerId={providerId!} value={provider.years_experience} onSaved={refetch} />

        {/* Quiz */}
        <Card className="rounded-2xl border-hairline p-5 space-y-4">
          <div className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-primary" />
            <div className="font-display text-lg">Pet safety quiz</div>
          </div>
          <p className="text-sm text-muted-foreground">
            5 questions. Score {PASS_THRESHOLD}+ to earn the <span className="font-medium text-primary">Safety trained</span> badge customers see when booking.
          </p>

          {quizPassed ? (
            <div className="rounded-xl bg-primary-soft text-primary p-4 text-sm flex items-center gap-2">
              <FileCheck2 className="h-4 w-4" />
              You passed on {new Date(provider.quiz_passed_at!).toLocaleDateString()}{provider.quiz_score != null ? ` — best score ${provider.quiz_score}/${QUIZ.length}` : ""}.
            </div>
          ) : (
            <>
              <div className="space-y-5">
                {QUIZ.map((q, qi) => (
                  <div key={qi} className="space-y-2">
                    <div className="text-sm font-medium">{qi + 1}. {q.q}</div>
                    <RadioGroup
                      value={answers[qi] !== undefined ? String(answers[qi]) : ""}
                      onValueChange={(v) => setAnswers((a) => ({ ...a, [qi]: Number(v) }))}
                    >
                      {q.options.map((opt, oi) => (
                        <div key={oi} className="flex items-start gap-2 rounded-lg border border-hairline p-2.5 text-sm">
                          <RadioGroupItem value={String(oi)} id={`q${qi}-o${oi}`} className="mt-0.5" />
                          <Label htmlFor={`q${qi}-o${oi}`} className="flex-1 cursor-pointer leading-snug">{opt}</Label>
                        </div>
                      ))}
                    </RadioGroup>
                  </div>
                ))}
              </div>
              <Button onClick={submitQuiz} disabled={submitting || !allAnswered} size="lg" className="w-full rounded-xl">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit quiz"}
              </Button>
            </>
          )}
        </Card>
      </div>
    </div>
  );
};

const DocSlot = ({ label, uploaded, loading, onPick }: { label: string; uploaded: boolean; loading: boolean; onPick: () => void }) => (
  <button
    type="button"
    onClick={onPick}
    disabled={loading}
    className={`rounded-xl border p-4 text-left transition-colors ${uploaded ? "border-primary/40 bg-primary-soft" : "border-hairline border-dashed bg-muted/30 hover:bg-muted/50"}`}
  >
    <div className="flex items-center gap-2">
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : uploaded ? <FileCheck2 className="h-4 w-4 text-primary" /> : <Upload className="h-4 w-4 text-muted-foreground" />}
      <span className="text-xs uppercase tracking-wide font-medium text-muted-foreground">{uploaded ? "Uploaded" : "Upload"}</span>
    </div>
    <div className="text-sm font-medium mt-1.5 leading-snug">{label}</div>
    {uploaded && <div className="text-[11px] text-primary mt-1">Tap to replace</div>}
  </button>
);

const YearsExperienceCard = ({ providerId, value, onSaved }: { providerId: string; value: number | null; onSaved: () => void }) => {
  const [years, setYears] = useState<string>(value != null ? String(value) : "");
  const [saving, setSaving] = useState(false);
  useEffect(() => { setYears(value != null ? String(value) : ""); }, [value]);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("service_providers")
      .update({ years_experience: years ? Math.max(0, Math.min(60, Number(years))) : null })
      .eq("id", providerId);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    onSaved();
  };

  return (
    <Card className="rounded-2xl border-hairline p-5 space-y-3">
      <div className="font-display text-lg">Years of experience</div>
      <div className="flex items-end gap-2">
        <div className="flex-1 space-y-1">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground font-medium">Years</Label>
          <Input type="number" inputMode="numeric" min={0} max={60} value={years} onChange={(e) => setYears(e.target.value)} className="h-11 rounded-xl border-hairline" />
        </div>
        <Button onClick={save} disabled={saving} className="rounded-xl h-11">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
        </Button>
      </div>
    </Card>
  );
};

export default ProviderTrust;