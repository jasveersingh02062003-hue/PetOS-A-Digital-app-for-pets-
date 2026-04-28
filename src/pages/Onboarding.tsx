import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowRight, Check, Loader2, MapPin } from "lucide-react";

const STEPS = ["You", "Your pet", "Vaccination", "Interests"] as const;

const INTERESTS = [
  "Socialize my pet", "Find a mate", "Vet help", "Walking & boarding", "Shopping",
];

const Onboarding = () => {
  const nav = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  // Step 1
  const [fullName, setFullName] = useState("");
  const [city, setCity] = useState("");
  // Step 2
  const [petName, setPetName] = useState("");
  const [species, setSpecies] = useState<"dog" | "cat" | "bird" | "rabbit" | "other">("dog");
  const [breed, setBreed] = useState("");
  const [dob, setDob] = useState("");
  const [gender, setGender] = useState<"male" | "female">("male");
  const [weight, setWeight] = useState("");
  const [neutered, setNeutered] = useState(false);
  const [bio, setBio] = useState("");
  // Step 3
  const [vaccineFile, setVaccineFile] = useState<File | null>(null);
  // Step 4
  const [discoverable, setDiscoverable] = useState(false);
  const [interests, setInterests] = useState<string[]>([]);

  const detectCity = async () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${pos.coords.latitude}&lon=${pos.coords.longitude}`);
          const j = await r.json();
          const c = j.address?.city || j.address?.town || j.address?.village || j.address?.state_district;
          if (c) setCity(c);
        } catch {}
      },
      () => toast.error("Location permission denied")
    );
  };

  const next = () => {
    if (step === 0) {
      const r = z.object({ fullName: z.string().trim().min(1).max(80), city: z.string().trim().min(1).max(80) }).safeParse({ fullName, city });
      if (!r.success) return toast.error("Add your name and city");
    }
    if (step === 1) {
      const r = z.object({ petName: z.string().trim().min(1).max(40), breed: z.string().trim().min(1).max(60) }).safeParse({ petName, breed });
      if (!r.success) return toast.error("Add your pet's name and breed");
    }
    setStep((s) => s + 1);
  };

  const submit = async () => {
    if (!user) return;
    setSubmitting(true);
    try {
      // Upload vaccine cert if provided
      let vaccinePath: string | null = null;
      if (vaccineFile) {
        const path = `${user.id}/vaccine-${Date.now()}-${vaccineFile.name}`;
        const { error: upErr } = await supabase.storage.from("vault-docs").upload(path, vaccineFile);
        if (upErr) throw upErr;
        vaccinePath = path;
      }

      // Update profile
      const { error: pErr } = await supabase.from("profiles").update({
        full_name: fullName,
        city,
        interests,
        onboarded: true,
      }).eq("id", user.id);
      if (pErr) throw pErr;

      // Insert pet
      const { error: petErr } = await supabase.from("pets").insert({
        owner_id: user.id,
        name: petName,
        species,
        breed,
        date_of_birth: dob || null,
        gender,
        weight_kg: weight ? Number(weight) : null,
        neutered,
        bio,
        city,
        discoverable_for_mating: discoverable,
        vaccination_verified: !!vaccinePath,
      });
      if (petErr) throw petErr;

      qc.invalidateQueries();
      toast.success("Welcome to Petos");
      nav("/", { replace: true });
    } catch (err: any) {
      toast.error(err.message || "Could not save");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container-app py-8">
        <div className="flex items-center gap-2 mb-8">
          {STEPS.map((_, i) => (
            <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i <= step ? "bg-primary" : "bg-muted"}`} />
          ))}
        </div>

        <div className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Step {step + 1} of {STEPS.length}</div>
        <h1 className="font-display text-3xl mb-8">{
          step === 0 ? "Tell us about you" :
          step === 1 ? "Add your first pet" :
          step === 2 ? "Vaccination certificate" :
          "What brings you here?"
        }</h1>

        {step === 0 && (
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
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-5">
            <Field label="Pet's name" value={petName} onChange={setPetName} />
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground font-medium">Species</Label>
                <Select value={species} onValueChange={(v: any) => setSpecies(v)}>
                  <SelectTrigger className="h-12 rounded-xl border-hairline bg-card"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["dog","cat","bird","rabbit","other"].map((s) => <SelectItem key={s} value={s}>{s[0].toUpperCase()+s.slice(1)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground font-medium">Gender</Label>
                <Select value={gender} onValueChange={(v: any) => setGender(v)}>
                  <SelectTrigger className="h-12 rounded-xl border-hairline bg-card"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Field label="Breed" value={breed} onChange={setBreed} placeholder="e.g. Indie, Labrador, Persian" />
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground font-medium">Date of birth</Label>
                <Input type="date" value={dob} onChange={(e) => setDob(e.target.value)} className="h-12 rounded-xl border-hairline bg-card" />
              </div>
              <Field label="Weight (kg)" value={weight} onChange={setWeight} type="number" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground font-medium">Bio</Label>
              <Textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} className="rounded-xl border-hairline bg-card resize-none" placeholder="A line or two about your pet" />
            </div>
            <label className="flex items-center justify-between bg-card border border-hairline rounded-xl p-4">
              <div>
                <div className="font-medium text-sm">Neutered / Spayed</div>
                <div className="text-xs text-muted-foreground">Used for health context</div>
              </div>
              <Switch checked={neutered} onCheckedChange={setNeutered} />
            </label>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <p className="text-sm text-muted-foreground leading-relaxed">
              Upload a photo or PDF of {petName || "your pet"}'s vaccination certificate. This earns a verified badge and unlocks the mating community.
            </p>
            <label className="block bg-card border border-dashed border-hairline rounded-2xl p-8 text-center cursor-pointer hover:border-primary/40 transition-colors">
              <input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => setVaccineFile(e.target.files?.[0] || null)} />
              {vaccineFile ? (
                <div className="flex items-center justify-center gap-2 text-sm">
                  <Check className="h-4 w-4 text-primary" />
                  <span className="font-medium">{vaccineFile.name}</span>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">Tap to upload certificate</div>
              )}
            </label>
            <p className="text-xs text-muted-foreground">You can add this later from the Health vault.</p>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-5">
            <p className="text-sm text-muted-foreground leading-relaxed">Pick what matters most. We'll personalize your feed.</p>
            <div className="flex flex-wrap gap-2">
              {INTERESTS.map((i) => {
                const active = interests.includes(i);
                return (
                  <Badge
                    key={i}
                    variant={active ? "default" : "outline"}
                    onClick={() => setInterests((p) => active ? p.filter((x) => x !== i) : [...p, i])}
                    className={`cursor-pointer text-sm py-2 px-4 rounded-full border-hairline ${active ? "" : "bg-card"}`}
                  >
                    {i}
                  </Badge>
                );
              })}
            </div>
            <label className="flex items-center justify-between bg-card border border-hairline rounded-xl p-4 mt-6">
              <div className="pr-4">
                <div className="font-medium text-sm">Discoverable for mating</div>
                <div className="text-xs text-muted-foreground">Other owners in your city can request a match. You stay in full control.</div>
              </div>
              <Switch checked={discoverable} onCheckedChange={setDiscoverable} />
            </label>
          </div>
        )}

        <div className="mt-10">
          {step < STEPS.length - 1 ? (
            <Button onClick={next} size="lg" className="w-full rounded-xl h-12">
              Continue <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={submit} disabled={submitting} size="lg" className="w-full rounded-xl h-12">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Finish"}
            </Button>
          )}
        </div>
      </div>
    </div>
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

export default Onboarding;
