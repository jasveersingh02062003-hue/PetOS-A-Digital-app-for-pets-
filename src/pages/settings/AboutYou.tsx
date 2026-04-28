import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MapPin, Camera } from "lucide-react";
import { SettingsLayout } from "./SettingsLayout";
import { uploadImageWithVariants } from "@/lib/uploadImage";

const AboutYou = () => {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const qc = useQueryClient();
  const [fullName, setFullName] = useState("");
  const [handle, setHandle] = useState("");
  const [bio, setBio] = useState("");
  const [city, setCity] = useState("");
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [language, setLanguage] = useState("en");
  const [weight, setWeight] = useState<"kg" | "lb">("kg");
  const [temp, setTemp] = useState<"c" | "f">("c");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const coverInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!profile) return;
    setFullName(profile.full_name ?? "");
    setHandle(((profile as any).handle as string) ?? "");
    setBio(profile.bio ?? "");
    setCity(profile.city ?? "");
    setCoverUrl(((profile as any).cover_url as string) ?? null);
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

  const onCoverChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    try {
      const r = await uploadImageWithVariants(file, "user-avatars");
      setCoverUrl(r.full);
      const { error } = await supabase.from("profiles").update({ cover_url: r.full } as any).eq("id", user.id);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Cover updated");
    } catch (err: any) {
      toast.error(err?.message ?? "Upload failed");
    } finally {
      setUploading(false);
      if (coverInput.current) coverInput.current.value = "";
    }
  };

  const save = async () => {
    if (!user) return;
    // Validate handle
    const cleanHandle = handle.trim().replace(/^@/, "").toLowerCase();
    if (cleanHandle && !/^[a-z0-9_]{3,30}$/.test(cleanHandle)) {
      toast.error("Handle must be 3–30 chars: letters, numbers, underscore");
      return;
    }
    setSaving(true);
    const patch: any = {
      full_name: fullName,
      bio: bio || null,
      handle: cleanHandle || null,
      city,
      language,
      units: { weight, temp },
    };
    if (coords) { patch.lat = coords.lat; patch.lng = coords.lng; }
    const { error } = await supabase.from("profiles").update(patch).eq("id", user.id);
    setSaving(false);
    if (error) {
      if (error.code === "23505" || /unique/i.test(error.message)) {
        toast.error("That @handle is taken");
      } else {
        toast.error(error.message);
      }
      return;
    }
    qc.invalidateQueries({ queryKey: ["profile"] });
    toast.success("Saved");
  };

  return (
    <SettingsLayout title="About you" subtitle="Identity, locality and units" onSave={save} saving={saving}>
      {/* Cover */}
      <div className="space-y-1.5">
        <Label className="text-xs uppercase tracking-wide text-muted-foreground font-medium">Cover photo</Label>
        <div className="aspect-[16/6] w-full rounded-2xl bg-muted overflow-hidden relative border border-hairline">
          {coverUrl ? (
            <img src={coverUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-primary/30 via-coral/20 to-amber/20" />
          )}
          <button
            type="button"
            onClick={() => coverInput.current?.click()}
            disabled={uploading}
            className="absolute bottom-2 right-2 h-9 px-3 rounded-full bg-background/90 backdrop-blur border border-hairline text-xs font-medium flex items-center gap-1.5"
          >
            <Camera className="h-3.5 w-3.5" />
            {uploading ? "Uploading…" : coverUrl ? "Change" : "Add cover"}
          </button>
          <input ref={coverInput} type="file" accept="image/*" className="hidden" onChange={onCoverChange} />
        </div>
      </div>

      <Field label="Full name" value={fullName} onChange={setFullName} />

      <div className="space-y-1.5">
        <Label className="text-xs uppercase tracking-wide text-muted-foreground font-medium">@handle</Label>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">@</span>
          <Input
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            placeholder="yourname"
            className="h-12 rounded-xl border-hairline bg-card flex-1"
          />
        </div>
        <p className="text-[11px] text-muted-foreground">3–30 chars. Letters, numbers, underscore. Used in your shareable link.</p>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs uppercase tracking-wide text-muted-foreground font-medium">Bio</Label>
        <Textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder="Dog mom to Bruno · Weekend hiker"
          maxLength={160}
          className="min-h-[80px] rounded-xl border-hairline bg-card"
        />
        <div className="text-[11px] text-muted-foreground text-right">{bio.length}/160</div>
      </div>

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
