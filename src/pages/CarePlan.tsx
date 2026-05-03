import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Sparkles, Check, AlertTriangle, Utensils, Syringe, GraduationCap, Scissors, Heart, Bell } from "lucide-react";
import { useSeo } from "@/hooks/useSeo";

const CATEGORY_META: Record<string, { icon: any; label: string; tone: string }> = {
  feeding: { icon: Utensils, label: "Feeding", tone: "leaf" },
  vaccine: { icon: Syringe, label: "Vaccine", tone: "sky" },
  training: { icon: GraduationCap, label: "Training", tone: "amber" },
  grooming: { icon: Scissors, label: "Grooming", tone: "lilac" },
  health: { icon: Heart, label: "Health", tone: "coral" },
  ai_tip: { icon: Sparkles, label: "AI tip", tone: "primary" },
  warning: { icon: AlertTriangle, label: "Warning", tone: "emergency" },
};

export default function CarePlan() {
  const { petId } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [generating, setGenerating] = useState(false);

  const { data: pet } = useQuery({
    queryKey: ["pet", petId],
    enabled: !!petId,
    queryFn: async () => {
      const { data, error } = await supabase.from("pets").select("*").eq("id", petId!).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: items, isLoading } = useQuery({
    queryKey: ["care-plan-items", petId],
    enabled: !!petId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pet_care_plan_items")
        .select("*")
        .eq("pet_id", petId!)
        .order("due_date", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  useSeo({ title: pet ? `${pet.name}'s care plan` : "Care plan" });

  const generate = async () => {
    if (!petId) return;
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-care-plan", { body: { pet_id: petId } });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success(`Generated ${(data as any).generated} care items`);
      qc.invalidateQueries({ queryKey: ["care-plan-items", petId] });
    } catch (e: any) {
      toast.error(e?.message ?? "Could not generate care plan");
    } finally {
      setGenerating(false);
    }
  };

  const markDone = async (id: string) => {
    const { error } = await supabase
      .from("pet_care_plan_items")
      .update({ status: "done", completed_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["care-plan-items", petId] });
  };

  const today = new Date().toISOString().slice(0, 10);
  const overdue = (items ?? []).filter((i: any) => i.status === "pending" && i.due_date < today);
  const todayItems = (items ?? []).filter((i: any) => i.status === "pending" && i.due_date === today);
  const upcoming = (items ?? []).filter((i: any) => i.status === "pending" && i.due_date > today);
  const done = (items ?? []).filter((i: any) => i.status === "done");

  return (
    <div className="container-app pad-top-safe pb-16">
      <header className="pt-6 pb-4">
        <button onClick={() => nav(-1)} className="inline-flex items-center gap-1 text-sm text-muted-foreground mb-3">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground font-semibold inline-flex items-center gap-1.5">
          <Sparkles className="h-3 w-3" /> Care Plan
        </div>
        <h1 className="font-display text-[28px] mt-1 leading-tight">{pet?.name ?? "Pet"}'s journey</h1>
        <p className="text-sm text-muted-foreground mt-1">Day-by-day what to feed, when to vaccinate, what to avoid.</p>
      </header>

      <Button onClick={generate} disabled={generating} className="w-full mb-5">
        {generating ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generating…</> : <>Regenerate plan</>}
      </Button>

      {isLoading && <div className="text-sm text-muted-foreground">Loading…</div>}

      {!isLoading && (items ?? []).length === 0 && (
        <Card className="p-6 rounded-2xl border-hairline text-center">
          <Bell className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <div className="font-display text-base mb-1">No care items yet</div>
          <p className="text-sm text-muted-foreground mb-3">Generate a personalised care plan tailored to your pet's species, breed and age.</p>
          <Button onClick={generate} disabled={generating}>Generate plan</Button>
        </Card>
      )}

      {overdue.length > 0 && <Section title="Overdue" items={overdue} onDone={markDone} tone="emergency" />}
      {todayItems.length > 0 && <Section title="Today" items={todayItems} onDone={markDone} tone="primary" />}
      {upcoming.length > 0 && <Section title="Upcoming" items={upcoming} onDone={markDone} />}
      {done.length > 0 && <Section title="Completed" items={done} onDone={markDone} muted />}
    </div>
  );
}

const Section = ({ title, items, onDone, tone, muted }: any) => (
  <div className="mb-5">
    <h2 className={`font-display text-base mb-2 ${tone === "emergency" ? "text-emergency" : tone === "primary" ? "text-primary" : ""}`}>{title}</h2>
    <div className="space-y-2">
      {items.map((it: any) => (
        <CareItem key={it.id} item={it} onDone={onDone} muted={muted} />
      ))}
    </div>
  </div>
);

const CareItem = ({ item, onDone, muted }: any) => {
  const meta = CATEGORY_META[item.category] ?? CATEGORY_META.health;
  const Icon = meta.icon;
  const [open, setOpen] = useState(false);
  return (
    <Card className={`p-3 rounded-2xl border-hairline ${muted ? "opacity-60" : ""}`}>
      <button onClick={() => setOpen(!open)} className="w-full text-left flex items-start gap-3">
        <div className={`h-9 w-9 rounded-xl bg-${meta.tone}/10 grid place-items-center shrink-0`}>
          <Icon className={`h-4 w-4 text-${meta.tone}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-2">
            <div className="font-medium text-sm truncate">{item.title}</div>
            <div className="text-[10px] text-muted-foreground shrink-0">{new Date(item.due_date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</div>
          </div>
          {item.body && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{item.body}</p>}
        </div>
      </button>
      {open && (
        <div className="mt-3 space-y-2 pl-12">
          {item.do_list?.length > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-wide text-leaf font-semibold mb-1">Do</div>
              <ul className="text-xs space-y-0.5">{item.do_list.map((d: string, i: number) => <li key={i}>✅ {d}</li>)}</ul>
            </div>
          )}
          {item.dont_list?.length > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-wide text-emergency font-semibold mb-1">Don't</div>
              <ul className="text-xs space-y-0.5">{item.dont_list.map((d: string, i: number) => <li key={i}>❌ {d}</li>)}</ul>
            </div>
          )}
          {item.red_flags?.length > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-wide text-amber font-semibold mb-1">Red flags — call vet</div>
              <ul className="text-xs space-y-0.5">{item.red_flags.map((d: string, i: number) => <li key={i}>🚨 {d}</li>)}</ul>
            </div>
          )}
          {item.status === "pending" && (
            <Button size="sm" variant="outline" onClick={() => onDone(item.id)} className="mt-1">
              <Check className="h-3 w-3 mr-1" /> Mark done
            </Button>
          )}
        </div>
      )}
    </Card>
  );
};
