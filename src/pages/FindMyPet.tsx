import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Sparkles, ArrowLeft, ArrowRight, Check, X, AlertTriangle, Heart, IndianRupee, Save } from "lucide-react";
import { useSeo } from "@/hooks/useSeo";
import { useAuth } from "@/hooks/useAuth";
import { useQuizDraft } from "@/hooks/useQuizDraft";
import { ContactSellerSheet } from "@/components/ContactSellerSheet";

type Question = {
  key: string;
  title: string;
  subtitle?: string;
  options: { value: string; label: string; emoji?: string }[];
};

const QUESTIONS: Question[] = [
  { key: "city_climate", title: "Where do you live?", subtitle: "Climate decides which breeds will thrive vs suffer.",
    options: [
      { value: "hot_humid", label: "Hot & humid (Mumbai, Chennai, Kolkata)", emoji: "🌴" },
      { value: "hot_dry", label: "Hot & dry (Delhi, Jaipur, Hyderabad)", emoji: "🌵" },
      { value: "temperate", label: "Temperate / Hill (Bangalore, Pune, Shimla)", emoji: "⛰️" },
      { value: "cold", label: "Cold (Kashmir, Northeast)", emoji: "❄️" },
    ] },
  { key: "home", title: "What's your home like?",
    options: [
      { value: "small_apt", label: "Small apartment (1BHK)", emoji: "🏢" },
      { value: "large_apt", label: "Large apartment (2-3BHK)", emoji: "🏬" },
      { value: "independent", label: "Independent house with yard", emoji: "🏡" },
      { value: "farmhouse", label: "Farmhouse / lots of space", emoji: "🌳" },
    ] },
  { key: "family", title: "Who lives with you?",
    options: [
      { value: "alone", label: "Just me", emoji: "🧍" },
      { value: "couple", label: "Couple, no kids", emoji: "👫" },
      { value: "kids", label: "Kids in the house", emoji: "👨‍👩‍👧" },
      { value: "elderly", label: "Elderly parents", emoji: "👴" },
    ] },
  { key: "experience", title: "How experienced are you with pets?",
    options: [
      { value: "first", label: "First-time pet parent", emoji: "🌱" },
      { value: "some", label: "Had a pet before", emoji: "🐾" },
      { value: "expert", label: "Very experienced", emoji: "🏆" },
    ] },
  { key: "time", title: "How much time can you give daily?",
    options: [
      { value: "low", label: "<1 hour", emoji: "⏱️" },
      { value: "med", label: "1-3 hours", emoji: "⏰" },
      { value: "high", label: "3+ hours", emoji: "🕒" },
    ] },
  { key: "budget", title: "Monthly budget for the pet (food + vet + supplies)?",
    options: [
      { value: "low", label: "Under ₹2,000", emoji: "💰" },
      { value: "med", label: "₹2,000 – ₹5,000", emoji: "💰💰" },
      { value: "high", label: "₹5,000 – ₹10,000", emoji: "💰💰💰" },
      { value: "premium", label: "₹10,000+", emoji: "💎" },
    ] },
  { key: "purpose", title: "Why do you want a pet?",
    options: [
      { value: "companion", label: "Companion / love", emoji: "❤️" },
      { value: "guard", label: "Guard / protection", emoji: "🛡️" },
      { value: "kids", label: "For my kids", emoji: "👶" },
      { value: "low_maintenance", label: "Low-maintenance buddy", emoji: "😌" },
    ] },
  { key: "noise", title: "How much noise can you tolerate?",
    options: [
      { value: "quiet", label: "Quiet only (apartment, neighbours)", emoji: "🤫" },
      { value: "moderate", label: "Some barking is OK", emoji: "🔉" },
      { value: "loud", label: "Don't mind a vocal pet", emoji: "📢" },
    ] },
  { key: "travel", title: "How often do you travel?",
    options: [
      { value: "rarely", label: "Rarely", emoji: "🏠" },
      { value: "monthly", label: "Once a month", emoji: "🚗" },
      { value: "frequent", label: "Often (work travel)", emoji: "✈️" },
    ] },
  { key: "allergies", title: "Anyone allergic to fur?",
    options: [
      { value: "no", label: "No", emoji: "✅" },
      { value: "mild", label: "Mild allergy", emoji: "🤧" },
      { value: "severe", label: "Severe allergy", emoji: "🚫" },
    ] },
];

type Result = {
  recommended: { species: string; breed: string; match_score: number; why_it_fits: string; monthly_cost_inr: string; energy_level: string }[];
  avoid: { species: string; breed: string; reason: string }[];
  owner_readiness: string[];
};

export default function FindMyPet() {
  useSeo({ title: "Find My Pet — Pet matchmaker for India", description: "Take a 2-minute quiz to find the best pet breed for your home, climate, family and budget." });
  const nav = useNavigate();

  // Retrieve saved state from localStorage
  const savedState = typeof window !== "undefined" ? JSON.parse(localStorage.getItem("findMyPetState") || "{}") : {};

  const [step, setStep] = useState(savedState.step || 0);
  const [answers, setAnswers] = useState<Record<string, string>>(savedState.answers || {});
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(savedState.result || null);
  const [showAuth, setShowAuth] = useState(false);

  const { user } = useAuth();
  const { saveDraft, mergeToAccount } = useQuizDraft();

  const saveState = (newState: any) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("findMyPetState", JSON.stringify(newState));
    }
  };

  const isLast = step === QUESTIONS.length - 1;
  const q = QUESTIONS[step];
  const value = answers[q?.key];

  const onPick = (v: string) => {
    const newAnswers = { ...answers, [q.key]: v };
    setAnswers(newAnswers);
    saveState({ step, answers: newAnswers, result });
    if (!isLast) {
      setTimeout(() => {
        setStep((s) => s + 1);
        saveState({ step: step + 1, answers: newAnswers, result });
      }, 150);
    }
  };

  const submit = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("breed-recommend", { body: { answers } });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setResult(data as Result);
      saveState({ step, answers, result: data });
    } catch (e: any) {
      toast.error(e?.message ?? "Could not generate recommendations");
      setResult(null); // Clear any partial/stale results on error
    } finally {
      setLoading(false);
    }
  };

  const recommended = result?.recommended || [];
  const avoid = result?.avoid || [];

  if (result) {
    return (
      <div className="container-app pad-top-safe pb-16">
        <header className="pt-6 pb-4">
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground font-semibold inline-flex items-center gap-1.5">
            <Sparkles className="h-3 w-3" /> Your matches
          </div>
          <h1 className="font-display text-[28px] mt-1 leading-tight">Your perfect pet</h1>
          <p className="text-sm text-muted-foreground mt-1">Based on your home, climate and lifestyle.</p>
        </header>

        <h2 className="font-display text-lg mb-3 flex items-center gap-2"><Heart className="h-4 w-4 text-coral" /> Best matches</h2>
        <div className="space-y-3 mb-6">
          {recommended.length === 0 && !loading && (
            <p className="text-sm text-muted-foreground italic">No specific recommendations found. Try adjusting your quiz answers.</p>
          )}
          {recommended.map((r, i) => (
            <Card key={i} className="p-4 rounded-2xl border-hairline">
              <div className="flex justify-between items-start gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs uppercase tracking-wide text-muted-foreground">{r.species}</span>
                    <span className="ml-auto text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary">{r.match_score}% match</span>
                  </div>
                   <div className="font-display text-lg">{r?.breed || "Unknown Breed"}</div>
                  <p className="text-sm text-muted-foreground mt-1">{r?.why_it_fits}</p>
                  <div className="flex gap-2 mt-2 text-[11px]">
                    <span className="px-2 py-0.5 rounded-full bg-muted inline-flex items-center gap-1"><IndianRupee className="h-3 w-3" />{r?.monthly_cost_inr || "0"}/mo</span>
                    <span className="px-2 py-0.5 rounded-full bg-muted">Energy: {r.energy_level}</span>
                  </div>
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <Button size="sm" variant="outline" className="flex-1" onClick={() => nav(`/breeds/${encodeURIComponent(r.species)}/${encodeURIComponent(r.breed)}`)}>Learn more</Button>
                <Button size="sm" className="flex-1" onClick={() => nav(`/mates/adopt?species=${encodeURIComponent(r.species)}`)}>Find one</Button>
              </div>
            </Card>
          ))}
        </div>

        {result.avoid?.length > 0 && (
          <>
            <h2 className="font-display text-lg mb-3 flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber" /> Avoid for you</h2>
            <div className="space-y-2 mb-6">
              {result.avoid.map((a, i) => (
                <Card key={i} className="p-3 rounded-xl border-hairline bg-amber/5">
                  <div className="font-medium text-sm">{a.breed} <span className="text-muted-foreground font-normal">· {a.species}</span></div>
                  <div className="text-xs text-muted-foreground mt-0.5">{a.reason}</div>
                </Card>
              ))}
            </div>
          </>
        )}

        {result.owner_readiness?.length > 0 && (
          <>
            <h2 className="font-display text-lg mb-3 flex items-center gap-2"><Check className="h-4 w-4 text-leaf" /> Before you bring one home</h2>
            <Card className="p-4 rounded-2xl border-hairline">
              <ul className="space-y-2">
                {result.owner_readiness.map((c, i) => (
                  <li key={i} className="flex gap-2 text-sm"><Check className="h-4 w-4 text-leaf shrink-0 mt-0.5" /><span>{c}</span></li>
                ))}
              </ul>
            </Card>
          </>
        )}

        <div className="mt-6 flex flex-col gap-3">
          {!user && (
            <Button 
              size="lg" 
              className="w-full bg-secondary hover:bg-secondary/90 text-secondary-foreground"
              onClick={() => {
                saveDraft({
                  species: (result.recommended[0]?.species as any) ?? "dog",
                  answers,
                  recommendations: result.recommended.map(r => r.breed),
                  timestamp: new Error().toISOString()
                });
                setShowAuth(true);
              }}
            >
              <Save className="h-4 w-4 mr-2" /> Save results to profile
            </Button>
          )}
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => { 
              setResult(null); setStep(0); setAnswers({}); 
              saveState({ step: 0, answers: {}, result: null });
            }}>Retake quiz</Button>
            <Button className="flex-1" onClick={() => nav("/breeds")}>Browse all breeds</Button>
          </div>
        </div>

        <ContactSellerSheet
          open={showAuth}
          onOpenChange={setShowAuth}
          intent={{ kind: "save_quiz", redirect: "/onboarding?stage=buyer" }}
          title="Save your results"
          description="We'll create an account for you so you can access your matches later."
        />
      </div>
    );
  }

  return (
    <div className="container-app pad-top-safe pb-16">
      <header className="pt-6 pb-6">
        <button onClick={() => {
          if (step === 0) nav(-1);
          else {
            setStep(step - 1);
            saveState({ step: step - 1, answers, result });
          }
        }} className="inline-flex items-center gap-1 text-sm text-muted-foreground mb-4">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <div className="flex justify-between items-center mb-2 text-xs text-muted-foreground">
          <span>Question {step + 1} of {QUESTIONS.length}</span>
          <span>~2 min</span>
        </div>
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-primary transition-all" style={{ width: `${((step + 1) / QUESTIONS.length) * 100}%` }} />
        </div>
      </header>

      <h1 className="font-display text-2xl mb-2 leading-tight">{q.title}</h1>
      {q.subtitle && <p className="text-sm text-muted-foreground mb-5">{q.subtitle}</p>}

      <div className="space-y-2.5 mb-8">
        {q.options.map((opt) => {
          const sel = value === opt.value;
          return (
            <button
              key={opt.value}
              onClick={() => onPick(opt.value)}
              className={`w-full text-left rounded-2xl border p-4 flex items-center gap-3 transition-all ${sel ? "border-primary bg-primary/5" : "border-hairline bg-card hover:bg-muted/30"}`}
            >
              {opt.emoji && <span className="text-2xl">{opt.emoji}</span>}
              <span className="text-sm font-medium flex-1">{opt.label}</span>
              {sel && <Check className="h-4 w-4 text-primary" />}
            </button>
          );
        })}
      </div>

      {isLast && (
        <Button onClick={submit} disabled={!value || loading} size="lg" className="w-full">
          {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Finding your match...</> : <>See my matches <ArrowRight className="h-4 w-4 ml-2" /></>}
        </Button>
      )}
    </div>
  );
}
