import { useEffect, useState, lazy, Suspense } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile, usePets } from "@/hooks/useProfile";
import { toast } from "sonner";
import {
  Heart, Loader2, PawPrint, Building2,
  Home as HomeIcon, ShieldHalf, ShieldAlert, Search as SearchIcon, Briefcase, Stethoscope,
} from "lucide-react";
import { StepShell } from "@/components/onboarding/StepShell";
import { IdentityStep } from "@/components/onboarding/IdentityStep";
import { track } from "@/lib/analytics";

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
  | "fork" | "identity" | "role" | "parent" | "buyer" | "rescuer" | "breeder"
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
  const stage: Stage = stageParam ?? "fork";

  const setStage = (s: Stage) => {
    if (s === "fork") setParams({}, { replace: true });
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
      setStage(isOnboarded ? "done" : "goals");
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

    // Pet-parent resume: has pets but hasn't picked goals yet → goals step.
    if (accountType === "pet_parent" && hasPets) {
      setStage("goals");
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

  // Role picker state
  const [role, setRole] = useState<RoleChoice>("pet_parent");
  const [roleSaving, setRoleSaving] = useState(false);

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
      void track("onboarding_step", { step: "role", action: "selected", role });
      setStage(opt.nextStage);
    } catch (e: any) {
      toast.error(e?.message ?? "Could not save");
    } finally {
      setRoleSaving(false);
    }
  };

  // ═════════════════════════════════════════════════════════════════════
  // STAGE ROUTER
  // ═════════════════════════════════════════════════════════════════════

  if (profileLoading || petsLoading) return <StageLoader />;

  if (stage === "fork") {
    return (
      <StepShell
        step={1}
        total={4}
        title="Welcome to Petos"
        subtitle="How can we help you today?"
        showCoach={false}
      >
        <div className="space-y-3">
          <button
            onClick={async () => {
              if (user) {
                await supabase.from("profiles").update({ account_type: "buyer" }).eq("id", user.id);
              }
              setStage("buyer");
            }}
            className="w-full text-left rounded-2xl border border-hairline p-5 bg-card hover:border-primary/50 transition group"
          >
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-2xl bg-primary/10 grid place-items-center shrink-0 group-hover:bg-primary/20 transition">
                <SearchIcon className="h-6 w-6 text-primary" />
              </div>
              <div>
                <div className="font-semibold text-base">I'm still researching</div>
                <div className="text-xs text-muted-foreground mt-0.5">Browse breeds, take the quiz, or find adoption listings.</div>
              </div>
            </div>
          </button>

          <button
            onClick={() => setStage("identity")}
            className="w-full text-left rounded-2xl border border-hairline p-5 bg-card hover:border-primary/50 transition group"
          >
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-2xl bg-secondary/10 grid place-items-center shrink-0 group-hover:bg-secondary/20 transition">
                <PawPrint className="h-6 w-6 text-secondary-foreground" />
              </div>
              <div>
                <div className="font-semibold text-base">I already have a pet</div>
                <div className="text-xs text-muted-foreground mt-0.5">Set up a care plan, track health, and get reminders.</div>
              </div>
            </div>
          </button>

          <div className="pt-4">
            <button 
              onClick={() => setStage("role")}
              className="text-xs text-muted-foreground hover:text-foreground underline transition block mx-auto"
            >
              I am a professional (Breeder, Vet, etc.)
            </button>
          </div>
        </div>
      </StepShell>
    );
  }

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
          avatarUrl: (profile as any)?.avatar_url,
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
    // Adding a 2nd/3rd/etc pet — reuse the rich wizard in additional mode.
    return (
      <Suspense fallback={<StageLoader />}>
        <FirstPetWizard isAdditional onDone={() => setStage("add-another")} />
      </Suspense>
    );
  }
  if (stage === "add-another") {
    return <Suspense fallback={<StageLoader />}><AddAnotherPet /></Suspense>;
  }
  if (stage === "goals") {
    return (
      <Suspense fallback={<StageLoader />}>
        <GoalsStep onDone={() => setStage("done")} />
      </Suspense>
    );
  }
  if (stage === "done") {
    return <Suspense fallback={<StageLoader />}><Done /></Suspense>;
  }
  if (stage === "parent") {
    // First pet — full rich wizard.
    return (
      <Suspense fallback={<StageLoader />}>
        <FirstPetWizard onDone={() => setStage("add-another")} />
      </Suspense>
    );
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

  // Fallback (should not normally hit — stage router covers all cases)
  return <StageLoader />;
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
