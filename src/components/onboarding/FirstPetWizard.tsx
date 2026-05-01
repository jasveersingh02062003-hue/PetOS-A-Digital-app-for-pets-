import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StepShell } from "@/components/onboarding/StepShell";
import { SpeciesPicker, type Species } from "@/components/onboarding/SpeciesPicker";
import { ChipGroup } from "@/components/onboarding/ChipGroup";
import { BREEDS, TEMPERAMENT_TAGS, COMMON_ALLERGIES, COMMON_CONDITIONS } from "@/lib/breeds";
import { uploadImageWithVariants } from "@/lib/uploadImage";
import { track } from "@/lib/analytics";
import { Camera, Loader2, Bell, Stethoscope, PawPrint, Heart, AlertCircle } from "lucide-react";
import { toast } from "sonner";

const OTHER = "__other__";

type Props = {
  /** Hide reminders & emergency-vet sections (used when adding additional pets). */
  isAdditional?: boolean;
  onDone: () => void;
};

/**
 * Rich first-pet onboarding wizard. Captures basics + behaviour + reminders
 * in one scrollable form. Persists to `pets` and `profiles.emergency_vet /
 * notif_prefs / reminder_prefs`, then calls `seed_pet_vaccine_reminders` so
 * real reminder rows exist immediately.
 */
export const FirstPetWizard = ({ isAdditional = false, onDone }: Props) => {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const qc = useQueryClient();
  useEffect(() => {
    void track("onboarding_step", {
      step: "pet",
      action: "started",
      additional: !!isAdditional,
    });
  }, [isAdditional]);

  // ── Section A: Basics ──
  const [name, setName] = useState("");
  const [species, setSpecies] = useState<Species>("dog");
  const [breed, setBreed] = useState("");
  const [breedOther, setBreedOther] = useState("");
  const [gender, setGender] = useState<"male" | "female">("male");
  const [ageMode, setAgeMode] = useState<"dob" | "approx">("dob");
  const [dob, setDob] = useState("");
  const [years, setYears] = useState("");
  const [months, setMonths] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);

  // ── Section B: Physical & Health ──
  const [weight, setWeight] = useState("");
  const [neutered, setNeutered] = useState<"yes" | "no" | "unknown">("unknown");
  const [microchip, setMicrochip] = useState("");
  const [vetName, setVetName] = useState("");
  const [vetPhone, setVetPhone] = useState("");

  // ── Section C: Behaviour ──
  const [temperament, setTemperament] = useState<string[]>([]);
  const [allergies, setAllergies] = useState<string[]>([]);
  const [conditions, setConditions] = useState<string[]>([]);

  // ── Section D: Reminders ──
  const [remindersOn, setRemindersOn] = useState(true);
  const [reminderKinds, setReminderKinds] = useState<string[]>(["vaccines", "deworming", "flea_tick", "checkup"]);
  const [channel, setChannel] = useState<"push" | "email">("push");

  const [saving, setSaving] = useState(false);

  const breedOptions = useMemo(() => BREEDS[species] ?? BREEDS.other, [species]);
  const finalBreed = breed === OTHER ? breedOther.trim() : breed;
  const weightUnit = (profile as any)?.units?.weight ?? "kg";

  const onPickPhoto = async (f: File | null) => {
    if (!f) return;
    setPhotoUploading(true);
    try {
      const v = await uploadImageWithVariants(f, "pet-avatars");
      setPhotoUrl(v.full);
    } catch (e: any) {
      toast.error(e?.message ?? "Photo upload failed");
    } finally {
      setPhotoUploading(false);
    }
  };

  const submit = async () => {
    if (!user) return;
    if (!name.trim()) return toast.error("Pet name is required");
    if (breed === OTHER && !breedOther.trim()) {
      return toast.error("Type the breed name (or pick one from the list)");
    }
    if (!finalBreed) return toast.error("Pick a breed (or type one)");

    let approxMonths: number | null = null;
    if (ageMode === "approx") {
      const y = parseInt(years || "0", 10);
      const m = parseInt(months || "0", 10);
      if (y === 0 && m === 0) return toast.error("Add an approximate age");
      approxMonths = y * 12 + m;
    }

    setSaving(true);
    try {
      // Convert weight to kg for storage
      let weightKg: number | null = null;
      if (weight) {
        const w = parseFloat(weight);
        if (!isNaN(w)) weightKg = weightUnit === "lb" ? w * 0.453592 : w;
      }

      const touchedHealth =
        temperament.length > 0 || allergies.length > 0 || conditions.length > 0 ||
        !!weightKg || !!microchip;

      // Tag user-typed "Other" breeds so future fuzzy-matching can find them.
      const breedToStore = breed === OTHER ? `Other: ${breedOther.trim()}` : finalBreed;

      const { data: petRow, error: petErr } = await supabase.from("pets").insert({
        owner_id: user.id,
        name: name.trim(),
        species,
        breed: breedToStore,
        gender,
        date_of_birth: ageMode === "dob" && dob ? dob : null,
        approx_age_months: approxMonths,
        weight_kg: weightKg,
        neutered: neutered === "yes" ? true : neutered === "no" ? false : null,
        microchip_id: microchip.trim() || null,
        temperament,
        allergies,
        conditions,
        avatar_url: photoUrl,
        city: profile?.city ?? null,
        lat: (profile as any)?.lat ?? null,
        lng: (profile as any)?.lng ?? null,
        health_setup_complete: touchedHealth,
      } as any).select("id").single();
      if (petErr) throw petErr;

      // Persist parent-only metadata: emergency vet + reminder prefs (only on first pet)
      if (!isAdditional) {
        const profilePatch: any = { id: user.id };
        if (vetName.trim() || vetPhone.trim()) {
          profilePatch.emergency_vet = {
            name: vetName.trim() || null,
            phone: vetPhone.trim() || null,
          };
        }
        const prefs = {
          vaccines: remindersOn && reminderKinds.includes("vaccines"),
          deworming: remindersOn && reminderKinds.includes("deworming"),
          flea_tick: remindersOn && reminderKinds.includes("flea_tick"),
          checkup: remindersOn && reminderKinds.includes("checkup"),
        };
        profilePatch.reminder_prefs = prefs;
        profilePatch.notif_prefs = {
          push: channel === "push",
          email: channel === "email",
          sms: false,
        };
        const { error: pErr } = await supabase
          .from("profiles")
          .upsert(profilePatch, { onConflict: "id" });
        if (pErr) throw pErr;
      }

      // Seed real vaccine reminders if user opted in for vaccines/deworming
      if (remindersOn && (reminderKinds.includes("vaccines") || reminderKinds.includes("deworming"))) {
        await supabase.rpc("seed_pet_vaccine_reminders" as any, { _pet_id: petRow!.id });
      }

      qc.invalidateQueries({ queryKey: ["pets"] });
      qc.invalidateQueries({ queryKey: ["profile", user.id] });
      void track("onboarding_step", {
        step: "pet",
        action: "submitted",
        additional: !!isAdditional,
        species,
        age_mode: ageMode,
        has_photo: !!photoUrl,
        has_emergency_vet: !isAdditional && !!(vetName.trim() || vetPhone.trim()),
        reminders_on: remindersOn,
        reminder_kinds_count: remindersOn ? reminderKinds.length : 0,
        temperament_count: temperament.length,
      });
      toast.success(`${name.trim()} added!`);
      onDone();
    } catch (e: any) {
      toast.error(e?.message ?? "Could not save pet");
    } finally {
      setSaving(false);
    }
  };

  const nextDisabled = !name.trim() || (!breed && !breedOther.trim()) || saving;

  return (
    <StepShell
      step={2}
      total={5}
      title={isAdditional ? "Add another pet" : "Meet your pet"}
      subtitle="Tell us the basics. Health and behaviour help us personalise tips and reminders."
      onNext={submit}
      loading={saving}
      nextDisabled={nextDisabled}
      nextLabel={isAdditional ? "Add pet" : "Add pet & continue"}
      showCoach={false}
    >
      <div className="space-y-7">
        {/* ── Section A — Basics ── */}
        <Section icon={PawPrint} title="Basics">
          <div className="flex items-center gap-4">
            <label className="relative h-20 w-20 rounded-2xl bg-muted overflow-hidden cursor-pointer flex items-center justify-center shrink-0 border border-dashed border-hairline">
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => onPickPhoto(e.target.files?.[0] ?? null)}
                disabled={photoUploading}
              />
              {photoUploading ? (
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              ) : photoUrl ? (
                <img src={photoUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <Camera className="h-6 w-6 text-muted-foreground" strokeWidth={1.5} />
              )}
            </label>
            <div className="flex-1 space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground font-medium">Pet's name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-12 rounded-xl border-hairline bg-card"
                placeholder="e.g. Bruno"
                maxLength={40}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground font-medium">Species</Label>
            <SpeciesPicker
              value={species}
              onChange={(s) => { setSpecies(s); setBreed(""); setBreedOther(""); }}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground font-medium">Breed</Label>
            <Select value={breed} onValueChange={setBreed}>
              <SelectTrigger className="h-12 rounded-xl border-hairline bg-card">
                <SelectValue placeholder="Choose a breed" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {breedOptions.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                <SelectItem value={OTHER}>Other / not listed</SelectItem>
              </SelectContent>
            </Select>
            {breed === OTHER && (
              <Input
                value={breedOther}
                onChange={(e) => setBreedOther(e.target.value)}
                placeholder="Type the breed"
                className="h-12 rounded-xl border-hairline bg-card"
                maxLength={60}
              />
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground font-medium">Sex</Label>
              <Select value={gender} onValueChange={(v: any) => setGender(v)}>
                <SelectTrigger className="h-12 rounded-xl border-hairline bg-card"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground font-medium">Age</Label>
              <div className="grid grid-cols-2 gap-1 h-12 rounded-xl border border-hairline bg-card p-1">
                <button
                  type="button"
                  onClick={() => setAgeMode("dob")}
                  className={`rounded-lg text-xs font-medium ${ageMode === "dob" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
                >
                  Birthday
                </button>
                <button
                  type="button"
                  onClick={() => setAgeMode("approx")}
                  className={`rounded-lg text-xs font-medium ${ageMode === "approx" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
                >
                  Approx
                </button>
              </div>
            </div>
          </div>

          {ageMode === "dob" ? (
            <Input
              type="date"
              value={dob}
              onChange={(e) => setDob(e.target.value)}
              max={new Date().toISOString().slice(0, 10)}
              className="h-12 rounded-xl border-hairline bg-card"
            />
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-[11px] text-muted-foreground">Years</Label>
                <Input type="number" min={0} max={40} value={years} onChange={(e) => setYears(e.target.value)} placeholder="0" className="h-12 rounded-xl border-hairline bg-card" />
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground">Months</Label>
                <Input type="number" min={0} max={11} value={months} onChange={(e) => setMonths(e.target.value)} placeholder="0" className="h-12 rounded-xl border-hairline bg-card" />
              </div>
            </div>
          )}
        </Section>

        {/* ── Section B — Physical & Health ── */}
        <Section icon={Stethoscope} title="Health basics" subtitle="All optional — helps with vet care.">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[11px] text-muted-foreground">Weight ({weightUnit})</Label>
              <Input type="number" step="0.1" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="0" className="h-12 rounded-xl border-hairline bg-card" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] text-muted-foreground">Spayed / Neutered</Label>
              <Select value={neutered} onValueChange={(v: any) => setNeutered(v)}>
                <SelectTrigger className="h-12 rounded-xl border-hairline bg-card"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="yes">Yes</SelectItem>
                  <SelectItem value="no">No</SelectItem>
                  <SelectItem value="unknown">Unknown</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11px] text-muted-foreground">Microchip ID</Label>
            <Input value={microchip} onChange={(e) => setMicrochip(e.target.value)} placeholder="Found on certificate" className="h-12 rounded-xl border-hairline bg-card" maxLength={40} />
          </div>

          {!isAdditional && (
            <div className="rounded-2xl border border-hairline p-3 space-y-2">
              <div className="text-xs font-medium">Emergency vet contact</div>
              <Input value={vetName} onChange={(e) => setVetName(e.target.value)} placeholder="Vet or clinic name" className="h-11 rounded-xl border-hairline bg-card" maxLength={80} />
              <Input value={vetPhone} onChange={(e) => setVetPhone(e.target.value)} placeholder="Phone number" type="tel" className="h-11 rounded-xl border-hairline bg-card" maxLength={20} />
              <p className="text-[11px] text-muted-foreground">Shown on Health tab so help is one tap away.</p>
            </div>
          )}
        </Section>

        {/* ── Section C — Behaviour & Health Tags ── */}
        <Section icon={Heart} title="Behaviour & health">
          <div className="space-y-1.5">
            <Label className="text-[11px] text-muted-foreground">Temperament</Label>
            <ChipGroup
              options={TEMPERAMENT_TAGS.map((t) => ({ value: t, label: t }))}
              value={temperament}
              onChange={setTemperament}
              columns={3}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px] text-muted-foreground">Known allergies</Label>
            <ChipGroup
              options={COMMON_ALLERGIES.map((t) => ({ value: t, label: t }))}
              value={allergies}
              onChange={setAllergies}
              columns={3}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px] text-muted-foreground">Existing conditions</Label>
            <ChipGroup
              options={COMMON_CONDITIONS.map((t) => ({ value: t, label: t }))}
              value={conditions}
              onChange={setConditions}
              columns={2}
            />
          </div>
        </Section>

        {/* ── Section D — Reminders (first pet only) ── */}
        {!isAdditional && (
          <Section icon={Bell} title="Care reminders">
            <button
              type="button"
              onClick={() => setRemindersOn(!remindersOn)}
              className={`w-full rounded-2xl border p-4 flex items-center justify-between ${remindersOn ? "border-primary bg-primary/5" : "border-hairline"}`}
            >
              <div className="text-left">
                <div className="text-sm font-medium">Send me care reminders</div>
                <div className="text-[11px] text-muted-foreground">We'll never spam — only what's due</div>
              </div>
              <div className={`h-6 w-11 rounded-full transition relative ${remindersOn ? "bg-primary" : "bg-muted"}`}>
                <div className={`absolute top-0.5 h-5 w-5 rounded-full bg-background shadow transition ${remindersOn ? "left-[1.4rem]" : "left-0.5"}`} />
              </div>
            </button>

            {remindersOn && (
              <>
                <ChipGroup
                  options={[
                    { value: "vaccines", label: "Vaccines" },
                    { value: "deworming", label: "Deworming" },
                    { value: "flea_tick", label: "Flea & tick" },
                    { value: "checkup", label: "Annual check-up" },
                  ]}
                  value={reminderKinds}
                  onChange={setReminderKinds}
                  columns={2}
                />
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setChannel("push")}
                    className={`rounded-xl border h-11 text-sm ${channel === "push" ? "border-primary bg-primary/5" : "border-hairline"}`}
                  >Push</button>
                  <button
                    type="button"
                    onClick={() => setChannel("email")}
                    className={`rounded-xl border h-11 text-sm ${channel === "email" ? "border-primary bg-primary/5" : "border-hairline"}`}
                  >Email</button>
                </div>
              </>
            )}
          </Section>
        )}
      </div>
    </StepShell>
  );
};

const Section = ({ icon: Icon, title, subtitle, children }: { icon: any; title: string; subtitle?: string; children: React.ReactNode }) => (
  <div className="space-y-3">
    <div className="flex items-center gap-2">
      <div className="h-7 w-7 rounded-lg bg-primary/10 grid place-items-center">
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div>
        <div className="text-sm font-semibold">{title}</div>
        {subtitle && <div className="text-[11px] text-muted-foreground">{subtitle}</div>}
      </div>
    </div>
    <div className="space-y-3 pl-1">{children}</div>
  </div>
);

export default FirstPetWizard;
