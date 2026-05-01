import { useEffect, useMemo, useState, lazy, Suspense } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile, usePets } from "@/hooks/useProfile";
import { z } from "zod";
import { toast } from "sonner";
import {
  Heart, Sparkles, Camera, Loader2, PawPrint, Building2,
  Home as HomeIcon, ShieldHalf, ShieldAlert, Search as SearchIcon, Briefcase, Stethoscope,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StepShell } from "@/components/onboarding/StepShell";
import { SpeciesPicker, type Species } from "@/components/onboarding/SpeciesPicker";
import { PetCardShare } from "@/components/onboarding/PetCardShare";
import { BREEDS } from "@/lib/breeds";
import { IdentityStep } from "@/components/onboarding/IdentityStep";

/**
 * UNIFIED ONBOARDING — single URL `/onboarding`, internal state machine.
 *
 * Chapters:
 *   1. identity → universal: name, @handle, city, language, units
 *   2. role     → pick role (everyone)
 *   3. role-specific mini-flow:
 *        parent  → add first pet (light: name/species/breed/dob/gender) → add-another → done
 *        buyer   → BuyerPrefs → done
 *        provider→ ProviderPicker → done
 *        rescuer → RescuerProfile → done
 *        breeder → BreederProfile → done (also kennel)
 *        org     → OrgOnboarding (verification) → done  (sanctuary, zoo)
 *
 * Pet-health questions (weight, vaccines, allergies, conditions) are NOT asked
 * here. The pet is created with `health_setup_complete: false`; HealthSetupReminder
 * surfaces on Home and the Health Vault to complete it later.
 */

type RoleChoice =
  | "pet_parent" | "buyer" | "provider" | "breeder"
  | "kennel" | "shelter" | "sanctuary" | "rescuer" | "zoo" | "vet";

type Stage =
  | "identity" | "role" | "parent" | "buyer" | "rescuer" | "breeder"
  | "org" | "provider" | "vet" | "add-pet" | "add-another" | "goals" | "done";

const ROLE_OPTIONS: { value: RoleChoice; title: string; sub: string; Icon: any; nextStage: Stage }[] = [
  { value: "pet_parent", title: "Pet parent", sub: "I have pets at home", Icon: PawPrint, nextStage: "parent" },
  { value: "buyer", title: "Looking to get a pet", sub: "Browse adoption & breeders", Icon: SearchIcon, nextStage: "buyer" },
  { value: "provider", title: "I offer pet services", sub: "Walker, groomer, sitter, driver…", Icon: Briefcase, nextStage: "provider" },
  { value: "vet", title: "Veterinarian", sub: "I treat pets professionally", Icon: Stethoscope, nextStage: "vet" },
  { value: "rescuer", title: "Independent rescuer", sub: "I rescue animals on my own", Icon: Heart, nextStage: "rescuer" },
  { value: "breeder", title: "Breeder", sub: "I breed pets responsibly", Icon: PawPrint, nextStage: "breeder" },
  { value: "kennel", title: "Kennel / Cattery", sub: "Registered facility", Icon: Building2, nextStage: "breeder" },
  { value: "shelter", title: "Shelter / Rescue NGO", sub: "We rescue and rehome animals", Icon: HomeIcon, nextStage: "rescuer" },
  { value: "sanctuary", title: "Sanctuary / Gaushala", sub: "Lifelong care for animals", Icon: ShieldHalf, nextStage: "org" },
  { value: "zoo", title: "Zoo / Wildlife centre", sub: "Education and donations", Icon: ShieldAlert, nextStage: "org" },
];

// Lazy-load embedded role flows
const BuyerPrefs = lazy(() => import("./onboarding/BuyerPrefs"));
const RescuerProfile = lazy(() => import("./onboarding/RescuerProfile"));
const BreederProfile = lazy(() => import("./onboarding/BreederProfile"));
const QuickAddPet = lazy(() => import("./onboarding/QuickAddPet"));
const AddAnotherPet = lazy(() => import("./onboarding/AddAnotherPet"));
const Done = lazy(() => import("./onboarding/Done"));
const OrgOnboarding = lazy(() => import("./OrgOnboarding"));
const ProviderPicker = lazy(() => import("./onboarding/provider/Picker"));
const FirstPetWizard = lazy(() => import("@/components/onboarding/FirstPetWizard"));
const GoalsStep = lazy(() => import("@/components/onboarding/GoalsStep"));

const Onboarding = () => {
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data: profile, isLoading: profileLoading } = useProfile();
  const { data: pets, isLoading: petsLoading } = usePets();

  const stageParam = (params.get("stage") as Stage | null) ?? null;
  const stage: Stage = stageParam ?? "identity";

  const setStage = (s: Stage) => {
    if (s === "identity") setParams({}, { replace: true });
    else setParams({ stage: s }, { replace: false });
  };

  // Resume mid-flow on refresh: identity → role → role-flow.
  useEffect(() => {
    if (profileLoading || petsLoading) return;

    const hasIdentity = !!profile?.handle && !!profile?.full_name;
    const accountType = profile?.account_type as RoleChoice | undefined;
    const hasPets = (pets?.length ?? 0) > 0;
    const isOnboarded = (profile as any)?.onboarded === true;

    if (stageParam === "parent" && accountType === "pet_parent" && hasPets) {
      setStage("done");
      return;
    }

    if (stageParam) return; // user is explicitly at a stage; respect it

    if (!hasIdentity) return; // stay on identity

    // Once a user has finished onboarding, never re-prompt them with the
    // role-specific mini-flow. Send them to the completion screen instead.
    if (isOnboarded) {
      setStage("done");
      return;
    }

    if (!accountType) {
      setStage("role");
      return;
    }

    if (accountType === "pet_parent" && hasPets) {
      setStage("done");
      return;
    }

    const opt = ROLE_OPTIONS.find((o) => o.value === accountType);
    if (opt) setStage(opt.nextStage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, profileLoading, pets, petsLoading, stageParam]);

  // Cross-component stage advance event (used by sub-pages).
  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<{ next: Stage }>;
      if (ce.detail?.next) setStage(ce.detail.next);
    };
    window.addEventListener("onboarding:advance", handler as EventListener);
    return () => window.removeEventListener("onboarding:advance", handler as EventListener);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── PET-PARENT MINI WIZARD STATE (light: identity is already saved) ──────
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [petAvatar, setPetAvatar] = useState<File | null>(null);
  const [petAvatarPreview, setPetAvatarPreview] = useState<string | null>(null);
  const [petName, setPetName] = useState("");
  const [species, setSpecies] = useState<Species>("dog");
  const [breed, setBreed] = useState("");
  const [dob, setDob] = useState("");
  const [gender, setGender] = useState<"male" | "female">("male");
  const [firstTimeParent, setFirstTimeParent] = useState<"yes" | "no" | "">("");
  const [petCount, setPetCount] = useState<"1" | "2" | "3+" | "">("");
  const [parentStep, setParentStep] = useState(0); // 0 about-you, 1 add-pet
  const breedOptions = useMemo(() => BREEDS[species] ?? BREEDS.other, [species]);

  // Role picker
  const [role, setRole] = useState<RoleChoice>("pet_parent");
  const [roleSaving, setRoleSaving] = useState(false);

  const onPickAvatar = (f: File | null) => {
    setPetAvatar(f);
    setPetAvatarPreview(f ? URL.createObjectURL(f) : null);
  };

  const handleRoleNext = async () => {
    if (!user) return;
    const opt = ROLE_OPTIONS.find((o) => o.value === role)!;
    setRoleSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .upsert({ id: user.id, account_type: role as any }, { onConflict: "id" });
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["profile", user.id] });
      setStage(opt.nextStage);
    } catch (e: any) {
      toast.error(e?.message ?? "Could not save");
    } finally {
      setRoleSaving(false);
    }
  };

  const submitPet = async () => {
    if (!user) return;
    const r = z.object({
      petName: z.string().trim().min(1).max(40),
      breed: z.string().trim().min(1).max(60),
    }).safeParse({ petName, breed });
    if (!r.success) return toast.error("Pet name and breed are required");

    setSubmitting(true);
    try {
      let avatarUrl: string | null = null;
      if (petAvatar) {
        const ext = petAvatar.name.split(".").pop() ?? "jpg";
        const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("pet-avatars").upload(path, petAvatar);
        if (upErr) throw upErr;
        const { data } = supabase.storage.from("pet-avatars").getPublicUrl(path);
        avatarUrl = data.publicUrl;
      }
      // Persist parent-only metadata first.
      const { error: profileErr } = await supabase.from("profiles").upsert({
        id: user.id,
        first_time_parent: firstTimeParent === "yes" ? true : firstTimeParent === "no" ? false : null,
      } as any, { onConflict: "id" });
      if (profileErr) throw profileErr;

      const { error: petErr } = await supabase.from("pets").insert({
        owner_id: user.id,
        name: petName,
        species,
        breed,
        date_of_birth: dob || null,
        gender,
        avatar_url: avatarUrl,
        city: profile?.city ?? null,
        lat: (profile as any)?.lat ?? null,
        lng: (profile as any)?.lng ?? null,
        health_setup_complete: false,
      } as any);
      if (petErr) throw petErr;

      const { error: onboardErr } = await supabase
        .from("profiles")
        .update({ onboarded: true } as any)
        .eq("id", user.id);
      if (onboardErr) throw onboardErr;

      qc.invalidateQueries();
      setDone(true);
    } catch (err: any) {
      toast.error(err.message ?? "Could not save");
    } finally {
      setSubmitting(false);
    }
  };

  // ═════════════════════════════════════════════════════════════════════
  // STAGE ROUTER
  // ═════════════════════════════════════════════════════════════════════

  if (profileLoading || petsLoading) return <StageLoader />;

  if (stage === "identity") {
    return (
      <IdentityStep
        initial={{
          fullName: profile?.full_name,
          handle: (profile as any)?.handle,
          city: profile?.city,
          language: (profile as any)?.language,
          units: (profile as any)?.units,
          email: user?.email,
        }}
        onComplete={() => setStage("role")}
      />
    );
  }

  if (stage === "buyer") {
    return <Suspense fallback={<StageLoader />}><BuyerPrefs /></Suspense>;
  }
  if (stage === "rescuer") {
    return <Suspense fallback={<StageLoader />}><RescuerProfile /></Suspense>;
  }
  if (stage === "breeder") {
    return <Suspense fallback={<StageLoader />}><BreederProfile /></Suspense>;
  }
  if (stage === "vet") {
    return <VetRedirect />;
  }
  if (stage === "org") {
    return <Suspense fallback={<StageLoader />}><OrgOnboarding /></Suspense>;
  }
  if (stage === "provider") {
    return <Suspense fallback={<StageLoader />}><ProviderPicker /></Suspense>;
  }
  if (stage === "add-pet") {
    return <Suspense fallback={<StageLoader />}><QuickAddPet /></Suspense>;
  }
  if (stage === "add-another") {
    return <Suspense fallback={<StageLoader />}><AddAnotherPet /></Suspense>;
  }
  if (stage === "done") {
    return <Suspense fallback={<StageLoader />}><Done /></Suspense>;
  }

  // ─── ROLE PICKER ─────────────────────────────────────────────────────────
  if (stage === "role") {
    return (
      <StepShell
        step={1}
        total={3}
        onBack={() => setStage("identity")}
        onNext={handleRoleNext}
        loading={roleSaving}
        nextLabel={role === "pet_parent" ? "Continue" : "Continue setup"}
        title="How will you use Petos?"
        subtitle="This personalises your home screen and what we ask next. You can change it later in settings."
        showCoach={false}
      >
        <div className="space-y-2">
          {ROLE_OPTIONS.map((o) => {
            const Icon = o.Icon;
            const active = role === o.value;
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => setRole(o.value)}
                className={`w-full text-left rounded-2xl border p-4 transition flex items-center gap-3 ${
                  active ? "border-primary bg-primary/5" : "border-hairline bg-card hover:border-foreground/20"
                }`}
              >
                <div className="h-10 w-10 rounded-xl bg-muted grid place-items-center shrink-0">
                  <Icon className="h-5 w-5" strokeWidth={1.6} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">{o.title}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">{o.sub}</div>
                </div>
              </button>
            );
          })}
        </div>
      </StepShell>
    );
  }

  // ─── PET-PARENT INLINE WIZARD ─────────────────────────────────────────────
  if (done) {
    return (
      <PetCardShare
        petName={petName}
        species={species}
        breed={breed}
        city={profile?.city ?? ""}
        avatar={petAvatarPreview}
        verified={false}
        onContinue={() => setStage("add-another")}
      />
    );
  }

  if (parentStep === 0) {
    return (
      <StepShell
        step={2}
        total={3}
        onBack={() => setStage("role")}
        onNext={() => setParentStep(1)}
        nextDisabled={!firstTimeParent || !petCount}
        title={`Hi ${profile?.full_name?.split(" ")[0] || "there"}!`}
        subtitle="A couple of quick questions so we can tailor your home and the AI vet's tone."
        showCoach={false}
      >
        <div className="space-y-5">
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground font-medium">First-time pet parent?</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setFirstTimeParent("yes")}
                className={`rounded-xl border h-12 text-sm font-medium transition ${
                  firstTimeParent === "yes" ? "border-primary bg-primary/5" : "border-hairline bg-card"
                }`}
              >
                Yes — I'm new
              </button>
              <button
                type="button"
                onClick={() => setFirstTimeParent("no")}
                className={`rounded-xl border h-12 text-sm font-medium transition ${
                  firstTimeParent === "no" ? "border-primary bg-primary/5" : "border-hairline bg-card"
                }`}
              >
                No — I've had pets
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground font-medium">How many pets do you have?</Label>
            <div className="grid grid-cols-3 gap-2">
              {(["1", "2", "3+"] as const).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setPetCount(c)}
                  className={`rounded-xl border h-12 text-sm font-medium transition ${
                    petCount === c ? "border-primary bg-primary/5" : "border-hairline bg-card"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground">
              We'll add them one at a time so you don't lose track.
            </p>
          </div>

          <div className="rounded-2xl border border-hairline bg-card p-4 flex items-start gap-3">
            <Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <p className="text-[12px] text-muted-foreground leading-relaxed">
              We'll set up <strong className="text-foreground">health, vaccines and weight</strong> later from
              the Health tab — they belong with daily care, not sign-up.
            </p>
          </div>
        </div>
      </StepShell>
    );
  }

  // parentStep === 1: add the first pet (light)
  return (
    <StepShell
      step={2}
      total={3}
      onBack={() => setParentStep(0)}
      onNext={submitPet}
      loading={submitting}
      nextLabel="Add pet"
      title="Meet your pet"
      subtitle="A photo and the basics. Health details come later — promise."
      showCoach={false}
    >
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
          <div className="flex-1 space-y-1.5">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground font-medium">Pet's name</Label>
            <Input
              value={petName}
              onChange={(e) => setPetName(e.target.value)}
              className="h-12 rounded-xl border-hairline bg-card"
              placeholder="e.g. Bruno"
              maxLength={40}
            />
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
          <p className="text-[11px] text-muted-foreground">Drives mating eligibility and breed-specific tips.</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground font-medium">Birthday or gotcha day</Label>
            <Input type="date" value={dob} onChange={(e) => setDob(e.target.value)} className="h-12 rounded-xl border-hairline bg-card" />
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
      </div>
    </StepShell>
  );
};

const StageLoader = () => (
  <div className="min-h-[60vh] grid place-items-center">
    <Loader2 className="h-6 w-6 animate-spin text-primary" />
  </div>
);

const VetRedirect = () => {
  const nav = useNavigate();
  useEffect(() => { nav("/vet/onboarding", { replace: true }); }, [nav]);
  return <StageLoader />;
};

export default Onboarding;
