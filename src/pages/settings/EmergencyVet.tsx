import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SettingsLayout } from "./SettingsLayout";

const EmergencyVet = () => {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [clinic, setClinic] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const e = (profile as any)?.emergency_vet ?? {};
    setName(e.name ?? "");
    setPhone(e.phone ?? "");
    setClinic(e.clinic ?? "");
  }, [profile]);

  const save = async () => {
    if (!user) return;
    setSaving(true);
    const payload = (name || phone || clinic) ? { name, phone, clinic } : null;
    const { error } = await supabase.from("profiles").update({ emergency_vet: payload }).eq("id", user.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["profile"] });
    toast.success("Saved");
  };

  return (
    <SettingsLayout title="Emergency vet" subtitle="One-tap call from the SOS button" onSave={save} saving={saving}>
      <Field label="Vet name" value={name} onChange={setName} />
      <Field label="Phone" value={phone} onChange={setPhone} type="tel" />
      <Field label="Clinic" value={clinic} onChange={setClinic} />
      <p className="text-[11px] text-muted-foreground">Shown as the primary call button on the Emergency sheet.</p>
    </SettingsLayout>
  );
};

const Field = ({ label, value, onChange, type = "text" }: any) => (
  <div className="space-y-1.5">
    <Label className="text-xs uppercase tracking-wide text-muted-foreground font-medium">{label}</Label>
    <Input value={value} onChange={(e) => onChange(e.target.value)} type={type} className="h-12 rounded-xl border-hairline bg-card" />
  </div>
);

export default EmergencyVet;
