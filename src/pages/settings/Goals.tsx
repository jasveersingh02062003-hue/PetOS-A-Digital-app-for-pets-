import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChipGroup } from "@/components/onboarding/ChipGroup";
import { GOALS } from "@/lib/breeds";
import { SettingsLayout } from "./SettingsLayout";

const GoalsPage = () => {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const qc = useQueryClient();
  const [goals, setGoals] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setGoals((profile as any)?.goals ?? []); }, [profile]);

  const save = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update({ goals }).eq("id", user.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["profile"] });
    toast.success("Saved");
  };

  return (
    <SettingsLayout title="Goals" subtitle="Personalises home and feed" onSave={save} saving={saving}>
      <ChipGroup
        options={GOALS.map((g) => ({ value: g.id, label: g.label, blurb: g.blurb }))}
        value={goals}
        onChange={setGoals}
      />
    </SettingsLayout>
  );
};

export default GoalsPage;
