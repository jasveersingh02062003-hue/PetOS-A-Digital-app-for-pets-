import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { StepShell } from "@/components/onboarding/StepShell";
import { ChipGroup } from "@/components/onboarding/ChipGroup";
import { GOALS } from "@/lib/breeds";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";

const GOAL_PREVIEW: Record<string, string> = {
  social: "Friend feed, walks, daily prompts pinned on Home",
  mating: "Verified breeding circles in Mates",
  vet: "AskVet & AI triage shortcut on Home",
  services: "Walking & boarding providers near you",
  shop: "Shop essentials with smart reorder reminders",
  vault: "Health vault, vaccine reminders & timeline",
};

export const GoalsStep = ({ onDone }: { onDone: () => void }) => {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const qc = useQueryClient();
  const [goals, setGoals] = useState<string[]>((profile as any)?.goals ?? []);
  const [saving, setSaving] = useState(false);

  const preview = useMemo(
    () => goals.map((g) => GOAL_PREVIEW[g]).filter(Boolean),
    [goals]
  );

  const submit = async () => {
    if (!user) return;
    if (goals.length === 0) return toast.error("Pick at least one goal");
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ goals, onboarded: true } as any)
        .eq("id", user.id);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["profile", user.id] });
      onDone();
    } catch (e: any) {
      toast.error(e?.message ?? "Could not save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <StepShell
      step={4}
      total={5}
      title="What brings you here?"
      subtitle="Pick any — we'll personalise your home feed."
      onNext={submit}
      loading={saving}
      nextDisabled={goals.length === 0 || saving}
      nextLabel="Finish"
      showCoach={false}
    >
      <div className="space-y-5">
        <ChipGroup
          options={GOALS.map((g) => ({ value: g.id, label: g.label, blurb: g.blurb }))}
          value={goals}
          onChange={setGoals}
          columns={2}
        />

        {preview.length > 0 && (
          <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <div className="text-xs font-semibold">Your home will show:</div>
            </div>
            <ul className="space-y-1.5">
              {preview.map((p, i) => (
                <li key={i} className="text-[12px] text-foreground/80 flex gap-2">
                  <span className="text-primary">•</span>{p}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </StepShell>
  );
};

export default GoalsStep;
