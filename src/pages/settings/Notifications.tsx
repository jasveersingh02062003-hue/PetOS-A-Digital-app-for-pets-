import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { SettingsLayout } from "./SettingsLayout";

const NotificationsPrefs = () => {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const qc = useQueryClient();
  const [push, setPush] = useState(true);
  const [email, setEmail] = useState(true);
  const [sms, setSms] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const p = (profile as any)?.notif_prefs ?? {};
    setPush(p.push ?? true);
    setEmail(p.email ?? true);
    setSms(p.sms ?? false);
  }, [profile]);

  const save = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update({
      notif_prefs: { push, email, sms },
    }).eq("id", user.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["profile"] });
    toast.success("Saved");
  };

  return (
    <SettingsLayout title="Notifications" subtitle="Pick the channels we can use" onSave={save} saving={saving}>
      <Row label="Push notifications" desc="Bookings, orders, vet replies, social" v={push} on={setPush} />
      <Row label="Email" desc="Weekly summary and important alerts" v={email} on={setEmail} />
      <Row label="SMS" desc="Critical alerts only" v={sms} on={setSms} />
      <a href="/install" className="block bg-card border border-hairline rounded-2xl p-4 mt-2">
        <div className="font-medium text-sm">Enable device notifications</div>
        <div className="text-[11px] text-muted-foreground leading-snug mt-0.5">
          Install Petos to your home screen and turn on system push notifications.
        </div>
      </a>
    </SettingsLayout>
  );
};

const Row = ({ label, desc, v, on }: { label: string; desc: string; v: boolean; on: (b: boolean) => void }) => (
  <label className="flex items-center justify-between gap-4 bg-card border border-hairline rounded-2xl p-4">
    <div>
      <div className="font-medium text-sm">{label}</div>
      <div className="text-[11px] text-muted-foreground leading-snug mt-0.5">{desc}</div>
    </div>
    <Switch checked={v} onCheckedChange={on} />
  </label>
);

export default NotificationsPrefs;
