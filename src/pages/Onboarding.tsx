import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { z } from "zod";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Heart, Shield, Sparkles, MapPin, Camera, Check, Loader2, Phone } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StepShell } from "@/components/onboarding/StepShell";
import { ChipGroup } from "@/components/onboarding/ChipGroup";
import { SpeciesPicker, type Species } from "@/components/onboarding/SpeciesPicker";
import { PetCardShare } from "@/components/onboarding/PetCardShare";
import { BREEDS, TEMPERAMENT_TAGS, COMMON_ALLERGIES, COMMON_CONDITIONS, GOALS } from "@/lib/breeds";

const TOTAL = 7;

type WelcomeCard = { icon: typeof Heart; title: string; copy: string };
const WELCOME: WelcomeCard[] = [
  { icon: Heart, title: "A complete digital life for every pet", copy: "Social, health vault, AI vet, mating, services and shop — one home." },
  { icon: Sparkles, title: "Personalised from day one", copy: "Every answer shapes your AI vet, your feed, and the help we surface." },
  { icon: Shield, title: "Your data, your rules", copy: "Mating discoverability is off by default. You're always in control." },
];

const Onboarding = () => {
  const nav = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data: profile, isLoading: profileLoading } = useProfile();

  // Role guard: this 7-step wizard is pet_parent-only. Any other role that
  // lands here (deep link, refresh after picking a role) gets bounced to the
  // proper chooser/wizard so we never try to insert a pet for a shelter, etc.
  useEffect(() => {
    if (profileLoading) return;
    const accountType = profile?.account_type ?? "pet_parent";
    if (accountType !== "pet_parent" && accountType !== "rescuer") {
      nav("/onboarding/account-type", { replace: true });
    }
  }, [profile, profileLoading, nav]);

  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  // Step 1 — About you
  const [fullName, setFullName] = useState("");
  const [city, setCity] = useState("");
  const [language, setLanguage] = useState("en");
  const [units, setUnits] = useState<{ weight: "kg" | "lb"; temp: "c" | "f" }>({ weight: "kg", temp: "c" });

  // Step 2 — Meet your pet
  const [petAvatar, setPetAvatar] = useState<File | null>(null);
  const [petAvatarPreview, setPetAvatarPreview] = useState<string | null>(null);
  const [petName, setPetName] = useState("");
  const [species, setSpecies] = useState<Species>("dog");
  const [breed, setBreed] = useState("");
  const [dob, setDob] = useState("");
  const [gender, setGender] = useState<"male" | "female">("male");

  // Step 3 — Body & lifestyle
  const [weight, setWeight] = useState("");
  const [neutered, setNeutered] = useState(false);
  const [activity, setActivity] = useState<"low" | "medium" | "high">("medium");
  const [diet, setDiet] = useState<"kibble" | "raw" | "home" | "mixed" | "prescription">("kibble");
  const [allergies, setAllergies] = useState<string[]>([]);
  const [conditions, setConditions] = useState<string[]>([]);

  // Step 4 — Personality
  const [temperament, setTemperament] = useState<string[]>([]);
  const [socialLevel, setSocialLevel] = useState<"solo" | "pairs" | "crowds">("pairs");

  // Step 5 — Goals
  const [goals, setGoals] = useState<string[]>([]);

  // Step 6 — Safety & consent
  const [vaccineFile, setVaccineFile] = useState<File | null>(null);
  const [emergencyName, setEmergencyName] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");
  const [emergencyClinic, setEmergencyClinic] = useState("");
  const [notifPush, setNotifPush] = useState(true);
  const [notifEmail, setNotifEmail] = useState(true);
  const [notifSms, setNotifSms] = useState(false);
  const [discoverable, setDiscoverable] = useState(false);

  const breedOptions = useMemo(() => BREEDS[species] ?? BREEDS.other, [species]);

  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);

  const detectCity = async () => {
    if (!navigator.geolocation) return toast.error("Location not available");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        try {
          const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${pos.coords.latitude}&lon=${pos.coords.longitude}`);
          const j = await r.json();
          const c = j.address?.city || j.address?.town || j.address?.village || j.address?.state_district;
          if (c) { setCity(c); toast.success(`Set city to ${c}`); }
        } catch {}
      },
      () => toast.error("Location permission denied")
    );
  };

  const onPickAvatar = (f: File | null) => {
    setPetAvatar(f);
    setPetAvatarPreview(f ? URL.createObjectURL(f) : null);
  };

  const validate = (s: number): string | null => {
    if (s === 1) {
      const r = z.object({
        fullName: z.string().trim().min(1).max(80),
        city: z.string().trim().min(1).max(80),
      }).safeParse({ fullName, city });
      return r.success ? null : "Add your name and city";
    }
    if (s === 2) {
      const r = z.object({
        petName: z.string().trim().min(1).max(40),
        breed: z.string().trim().min(1).max(60),
      }).safeParse({ petName, breed });
      return r.success ? null : "Pet name and breed are required";
    }
    return null;
  };

  const next = () => {
    const err = validate(step);
    if (err) return toast.error(err);
    if (step < TOTAL - 1) setStep(step + 1);
    else submit();
  };

  const back = () => step > 0 && setStep(step - 1);

  const submit = async () => {
    if (!user) return;
    setSubmitting(true);
    try {
      // Upload avatar
      let avatarUrl: string | null = null;
      if (petAvatar) {
        const ext = petAvatar.name.split(".").pop() ?? "jpg";
        const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("pet-avatars").upload(path, petAvatar);
        if (upErr) throw upErr;
        const { data } = supabase.storage.from("pet-avatars").getPublicUrl(path);
        avatarUrl = data.publicUrl;
      }

      // Upload vaccine
      let vaccinePath: string | null = null;
      if (vaccineFile) {
        const path = `${user.id}/vaccine-${Date.now()}-${vaccineFile.name}`;
        const { error: upErr } = await supabase.storage.from("vault-docs").upload(path, vaccineFile);
        if (upErr) throw upErr;
        vaccinePath = path;
      }

      // Profile
      const emergencyVet =
        emergencyPhone.trim() || emergencyName.trim() || emergencyClinic.trim()
          ? { name: emergencyName.trim(), phone: emergencyPhone.trim(), clinic: emergencyClinic.trim() }
          : null;

      const { error: pErr } = await supabase.from("profiles").upsert({
        id: user.id,
        full_name: fullName,
        city,
        lat: coords?.lat ?? null,
        lng: coords?.lng ?? null,
        language,
        units,
        goals,
        emergency_vet: emergencyVet,
        notif_prefs: { push: notifPush, email: notifEmail, sms: notifSms },
        onboarded: true,
      }, { onConflict: "id" });
      if (pErr) throw pErr;

      // Pet
      const { data: petRow, error: petErr } = await supabase.from("pets").insert({
        owner_id: user.id,
        name: petName,
        species,
        breed,
        date_of_birth: dob || null,
        gender,
        weight_kg: weight ? Number(weight) : null,
        neutered,
        avatar_url: avatarUrl,
        city,
        lat: coords?.lat ?? null,
        lng: coords?.lng ?? null,
        activity_level: activity,
        diet_type: diet,
        social_level: socialLevel,
        allergies,
        conditions,
        temperament,
        discoverable_for_mating: neutered ? false : discoverable,
        vaccination_verified: !!vaccinePath,
      }).select("id").single();
      if (petErr) throw petErr;

      // Vault entry
      if (vaccinePath && petRow) {
        await supabase.from("vault_documents").insert({
          pet_id: petRow.id,
          title: "Vaccination certificate",
          category: "vaccination",
          file_path: vaccinePath,
          mime_type: vaccineFile?.type ?? null,
          size_bytes: vaccineFile?.size ?? null,
        });
      }

      qc.invalidateQueries();
      setDone(true);
    } catch (err: any) {
      toast.error(err.message ?? "Could not save");
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <PetCardShare
        petName={petName}
        species={species}
        breed={breed}
        city={city}
        avatar={petAvatarPreview}
        verified={!!vaccineFile}
        onContinue={() => nav("/", { replace: true })}
      />
    );
  }

  // STEP RENDERERS ----------------------------------------------------------
  const sharedProps = {
    step, total: TOTAL, onBack: step > 0 ? back : undefined, onNext: next,
    loading: submitting, nextLabel: step === TOTAL - 1 ? "Finish" : "Continue",
  };

  if (step === 0) {
    return (
      <StepShell
        {...sharedProps}
        title="Welcome to Petos"
        subtitle="A few thoughtful questions — every answer makes the app smarter for you and your pet."
      >
        <div className="space-y-3">
          {WELCOME.map((c, i) => (
            <motion.div
              key={c.title}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 + 0.1, duration: 0.4 }}
              className="bg-card border border-hairline rounded-2xl p-4 flex gap-3"
            >
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <c.icon className="h-5 w-5 text-primary" strokeWidth={1.6} />
              </div>
              <div>
                <div className="font-medium text-sm">{c.title}</div>
                <div className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{c.copy}</div>
              </div>
            </motion.div>
          ))}
        </div>
      </StepShell>
    );
  }

  if (step === 1) {
    return (
      <StepShell {...sharedProps} title="Tell us about you" subtitle="So we can greet you and tailor distance, language and units.">
        <div className="space-y-5">
          <Field label="Full name" value={fullName} onChange={setFullName} />
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground font-medium">City</Label>
            <div className="flex gap-2">
              <Input value={city} onChange={(e) => setCity(e.target.value)} className="h-12 rounded-xl border-hairline bg-card flex-1" />
              <Button type="button" variant="outline" onClick={detectCity} className="h-12 rounded-xl border-hairline px-3">
                <MapPin className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">Used for nearby vets, services and breeding circles.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <SelectField label="Language" value={language} onChange={setLanguage} options={[
              { v: "en", l: "English" }, { v: "hi", l: "हिन्दी" }, { v: "ta", l: "தமிழ்" },
              { v: "te", l: "తెలుగు" }, { v: "mr", l: "मराठी" }, { v: "bn", l: "বাংলা" },
            ]} />
            <SelectField label="Weight" value={units.weight} onChange={(v: any) => setUnits({ ...units, weight: v })} options={[
              { v: "kg", l: "Kilograms" }, { v: "lb", l: "Pounds" },
            ]} />
          </div>
          <p className="text-[11px] text-muted-foreground -mt-2">AI vet replies in your language; charts use your units.</p>
        </div>
      </StepShell>
    );
  }

  if (step === 2) {
    return (
      <StepShell {...sharedProps} title="Meet your pet" subtitle="A photo and the basics. This becomes your pet's identity across Petos.">
        <div className="space-y-5">
          <div className="flex items-center gap-4">
            <label className="relative h-20 w-20 rounded-2xl bg-muted overflow-hidden cursor-pointer flex items-center justify-center shrink-0 border border-dashed border-hairline">
              <input type="file" accept="image/*" className="hidden" onChange={(e) => onPickAvatar(e.target.files?.[0] ?? null)} />
              {petAvatarPreview ? (
                <img src={petAvatarPreview} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" />
              ) : (
                <Camera className="h-6 w-6 text-muted-foreground" strokeWidth={1.5} />
              )}
            </label>
            <div className="flex-1">
              <Field label="Pet's name" value={petName} onChange={setPetName} />
            </div>
          </div>

          <div>
            <Label className="text-xs uppercase tracking-wide text-muted-foreground font-medium">Species</Label>
            <div className="mt-2"><SpeciesPicker value={species} onChange={(s) => { setSpecies(s); setBreed(""); }} /></div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground font-medium">Breed</Label>
            <Select value={breed} onValueChange={setBreed}>
              <SelectTrigger className="h-12 rounded-xl border-hairline bg-card"><SelectValue placeholder="Choose a breed" /></SelectTrigger>
              <SelectContent className="max-h-72">
                {breedOptions.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">Drives mating eligibility and breed-specific health alerts.</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground font-medium">Date of birth</Label>
              <Input type="date" value={dob} onChange={(e) => setDob(e.target.value)} className="h-12 rounded-xl border-hairline bg-card" />
            </div>
            <SelectField label="Gender" value={gender} onChange={(v: any) => setGender(v)} options={[
              { v: "male", l: "Male" }, { v: "female", l: "Female" },
            ]} />
          </div>
        </div>
      </StepShell>
    );
  }

  if (step === 3) {
    return (
      <StepShell {...sharedProps} title="Body & lifestyle" subtitle="Powers calorie math, drug-safe AI replies, food filters and service matching.">
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <Field label={`Weight (${units.weight})`} value={weight} onChange={setWeight} type="number" />
            <label className="flex items-center justify-between bg-card border border-hairline rounded-xl px-4 h-[68px]">
              <div className="pr-2">
                <div className="font-medium text-sm">Neutered</div>
                <div className="text-[11px] text-muted-foreground leading-tight">Affects breeding & hormones</div>
              </div>
              <Switch checked={neutered} onCheckedChange={setNeutered} />
            </label>
          </div>

          <div>
            <Label className="text-xs uppercase tracking-wide text-muted-foreground font-medium mb-2 block">Activity level</Label>
            <ChipGroup
              columns={3}
              multi={false}
              value={[activity]}
              onChange={(v) => v[0] && setActivity(v[0] as any)}
              options={[
                { value: "low", label: "Low", blurb: "Mostly indoor" },
                { value: "medium", label: "Medium", blurb: "Daily walks" },
                { value: "high", label: "High", blurb: "Runs & play" },
              ]}
            />
          </div>

          <div>
            <Label className="text-xs uppercase tracking-wide text-muted-foreground font-medium mb-2 block">Diet</Label>
            <ChipGroup
              multi={false}
              value={[diet]}
              onChange={(v) => v[0] && setDiet(v[0] as any)}
              options={[
                { value: "kibble", label: "Kibble" },
                { value: "raw", label: "Raw" },
                { value: "home", label: "Home-cooked" },
                { value: "mixed", label: "Mixed" },
                { value: "prescription", label: "Prescription" },
              ]}
            />
          </div>

          <div>
            <Label className="text-xs uppercase tracking-wide text-muted-foreground font-medium mb-2 block">Known allergies</Label>
            <ChipGroup options={COMMON_ALLERGIES} value={allergies} onChange={setAllergies} />
            <p className="text-[11px] text-muted-foreground mt-2">We'll warn you in shop and AI replies.</p>
          </div>

          <div>
            <Label className="text-xs uppercase tracking-wide text-muted-foreground font-medium mb-2 block">Existing conditions</Label>
            <ChipGroup options={COMMON_CONDITIONS} value={conditions} onChange={setConditions} />
          </div>
        </div>
      </StepShell>
    );
  }

  if (step === 4) {
    return (
      <StepShell {...sharedProps} title={`How would you describe ${petName || "your pet"}?`} subtitle="Helps with mating compatibility, boarding and dog-park suggestions.">
        <div className="space-y-6">
          <div>
            <Label className="text-xs uppercase tracking-wide text-muted-foreground font-medium mb-2 block">Temperament</Label>
            <ChipGroup options={TEMPERAMENT_TAGS} value={temperament} onChange={setTemperament} columns={3} />
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wide text-muted-foreground font-medium mb-2 block">Social comfort</Label>
            <ChipGroup
              multi={false}
              value={[socialLevel]}
              onChange={(v) => v[0] && setSocialLevel(v[0] as any)}
              options={[
                { value: "solo", label: "Prefers solo", blurb: "One-on-one only" },
                { value: "pairs", label: "Small groups", blurb: "Comfortable in pairs" },
                { value: "crowds", label: "Loves crowds", blurb: "Thrives at parks" },
              ]}
              columns={1}
            />
          </div>
        </div>
      </StepShell>
    );
  }

  if (step === 5) {
    return (
      <StepShell {...sharedProps} title="What brings you here?" subtitle="We'll order your home screen and feed around what matters most. Pick a few.">
        <ChipGroup
          options={GOALS.map((g) => ({ value: g.id, label: g.label, blurb: g.blurb }))}
          value={goals}
          onChange={setGoals}
        />
      </StepShell>
    );
  }

  // step === 6: Safety & consent
  return (
    <StepShell {...sharedProps} title="Safety & consent" subtitle="The last piece. Vaccination earns a verified badge; emergency vet appears in our SOS button.">
      <div className="space-y-5">
        <label className="block bg-card border border-dashed border-hairline rounded-2xl p-5 text-center cursor-pointer hover:border-primary/40 transition-colors">
          <input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => setVaccineFile(e.target.files?.[0] ?? null)} />
          {vaccineFile ? (
            <div className="flex items-center justify-center gap-2 text-sm">
              <Check className="h-4 w-4 text-primary" />
              <span className="font-medium">{vaccineFile.name}</span>
            </div>
          ) : (
            <div>
              <div className="text-sm font-medium">Upload vaccination certificate</div>
              <div className="text-[11px] text-muted-foreground mt-1">Optional · earns verified badge & unlocks mating</div>
            </div>
          )}
        </label>

        <div className="bg-card border border-hairline rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-primary" />
            <div className="text-sm font-medium">Emergency vet (optional)</div>
          </div>
          <p className="text-[11px] text-muted-foreground -mt-1">One-tap call from the SOS button when something's wrong.</p>
          <Input placeholder="Vet name" value={emergencyName} onChange={(e) => setEmergencyName(e.target.value)} className="h-11 rounded-xl border-hairline bg-background" />
          <Input placeholder="Phone" value={emergencyPhone} onChange={(e) => setEmergencyPhone(e.target.value)} className="h-11 rounded-xl border-hairline bg-background" type="tel" />
          <Input placeholder="Clinic name" value={emergencyClinic} onChange={(e) => setEmergencyClinic(e.target.value)} className="h-11 rounded-xl border-hairline bg-background" />
        </div>

        <div className="bg-card border border-hairline rounded-2xl p-4 space-y-3">
          <div className="text-sm font-medium">How can we reach you?</div>
          <ToggleRow label="Push notifications" desc="Bookings, orders, vet replies" checked={notifPush} onChange={setNotifPush} />
          <ToggleRow label="Email" desc="Weekly summary & important alerts" checked={notifEmail} onChange={setNotifEmail} />
          <ToggleRow label="SMS" desc="Critical alerts only" checked={notifSms} onChange={setNotifSms} />
        </div>

        <ToggleRow
          label="Discoverable for mating"
          desc={
            neutered
              ? `Since ${petName || "your pet"} is neutered, mating discovery stays off. Every other feature still works.`
              : "Other verified owners in your city can request a match. Off by default."
          }
          checked={neutered ? false : discoverable}
          onChange={(v) => !neutered && setDiscoverable(v)}
          card
          disabled={neutered}
        />
      </div>
    </StepShell>
  );
};

const Field = ({ label, value, onChange, type = "text", placeholder }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string;
}) => (
  <div className="space-y-1.5">
    <Label className="text-xs uppercase tracking-wide text-muted-foreground font-medium">{label}</Label>
    <Input value={value} onChange={(e) => onChange(e.target.value)} type={type} placeholder={placeholder} className="h-12 rounded-xl border-hairline bg-card" />
  </div>
);

const SelectField = ({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: { v: string; l: string }[];
}) => (
  <div className="space-y-1.5">
    <Label className="text-xs uppercase tracking-wide text-muted-foreground font-medium">{label}</Label>
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-12 rounded-xl border-hairline bg-card"><SelectValue /></SelectTrigger>
      <SelectContent>{options.map((o) => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}</SelectContent>
    </Select>
  </div>
);

const ToggleRow = ({ label, desc, checked, onChange, card, disabled }: {
  label: string; desc?: string; checked: boolean; onChange: (v: boolean) => void; card?: boolean; disabled?: boolean;
}) => (
  <label className={`flex items-center justify-between gap-4 ${card ? "bg-card border border-hairline rounded-2xl p-4" : ""} ${disabled ? "opacity-70" : ""}`}>
    <div className="min-w-0">
      <div className="font-medium text-sm">{label}</div>
      {desc && <div className="text-[11px] text-muted-foreground leading-snug mt-0.5">{desc}</div>}
    </div>
    <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} />
  </label>
);

export default Onboarding;
