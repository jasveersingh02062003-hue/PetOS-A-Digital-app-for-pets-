import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MapPin } from "lucide-react";
import { SettingsLayout } from "./SettingsLayout";

const AboutYou = () => {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const qc = useQueryClient();
  const [fullName, setFullName] = useState("");
  const [city, setCity] = useState("");
  const [language, setLanguage] = useState("en");
  const [weight, setWeight] = useState<"kg" | "lb">("kg");
  const [temp, setTemp] = useState<"c" | "f">("c");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setFullName(profile.full_name ?? "");
    setCity(profile.city ?? "");
    setLanguage((profile as any).language ?? "en");
    const u = (profile as any).units ?? {};
    setWeight(u.weight ?? "kg");
    setTemp(u.temp ?? "c");
  }, [profile]);

  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);

  const detectCity = async () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(async (pos) => {
      setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      try {
        const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${pos.coords.latitude}&lon=${pos.coords.longitude}`);
        const j = await r.json();
        const c = j.address?.city || j.address?.town || j.address?.village;
        if (c) setCity(c);
      } catch {}
    });
  };

  const save = async () => {
    if (!user) return;
    setSaving(true);
    const patch: any = { full_name: fullName, city, language, units: { weight, temp } };
    if (coords) { patch.lat = coords.lat; patch.lng = coords.lng; }
    const { error } = await supabase.from("profiles").update(patch).eq("id", user.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["profile"] });
    toast.success("Saved");
  };

  return (
    <SettingsLayout title="About you" subtitle="Identity, locality and units" onSave={save} saving={saving}>
      <Field label="Full name" value={fullName} onChange={setFullName} />
      <div className="space-y-1.5">
        <Label className="text-xs uppercase tracking-wide text-muted-foreground font-medium">City</Label>
        <div className="flex gap-2">
          <Input value={city} onChange={(e) => setCity(e.target.value)} className="h-12 rounded-xl border-hairline bg-card flex-1" />
          <Button type="button" variant="outline" onClick={detectCity} className="h-12 rounded-xl border-hairline px-3"><MapPin className="h-4 w-4" /></Button>
        </div>
      </div>
      <SelectField label="Language" value={language} onChange={setLanguage} options={[
        { v: "en", l: "English" }, { v: "hi", l: "हिन्दी" }, { v: "ta", l: "தமிழ்" },
        { v: "te", l: "తెలుగు" }, { v: "mr", l: "मराठी" }, { v: "bn", l: "বাংলা" },
      ]} />
      <div className="grid grid-cols-2 gap-3">
        <SelectField label="Weight" value={weight} onChange={(v: any) => setWeight(v)} options={[
          { v: "kg", l: "Kilograms" }, { v: "lb", l: "Pounds" },
        ]} />
        <SelectField label="Temperature" value={temp} onChange={(v: any) => setTemp(v)} options={[
          { v: "c", l: "Celsius" }, { v: "f", l: "Fahrenheit" },
        ]} />
      </div>
    </SettingsLayout>
  );
};

const Field = ({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) => (
  <div className="space-y-1.5">
    <Label className="text-xs uppercase tracking-wide text-muted-foreground font-medium">{label}</Label>
    <Input value={value} onChange={(e) => onChange(e.target.value)} className="h-12 rounded-xl border-hairline bg-card" />
  </div>
);
const SelectField = ({ label, value, onChange, options }: any) => (
  <div className="space-y-1.5">
    <Label className="text-xs uppercase tracking-wide text-muted-foreground font-medium">{label}</Label>
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-12 rounded-xl border-hairline bg-card"><SelectValue /></SelectTrigger>
      <SelectContent>{options.map((o: any) => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}</SelectContent>
    </Select>
  </div>
);

export default AboutYou;
