import { ReactNode, useEffect } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { isPublicRoute } from "@/lib/publicRoutes";
import { useAuth } from "@/hooks/useAuth";
import { useProfile, usePets } from "@/hooks/useProfile";
import { HomeSkeleton } from "./HomeSkeleton";

const SEEN_KEY = "petos_seen_intro";

/**
 * Gates the main tab routes. Order matters — never navigate while loading.
 *   1. authLoading → skeleton (matches Home structure, no jarring flash)
 *   2. !user → /welcome (first device visit) or /auth?redirect=…
 *   3. user but profile/pets loading → skeleton
 *   4. profile incomplete → /onboarding
 *   5. else → render children
 *
 * Perf notes:
 *   - We preload the PetParentHome chunk the moment auth resolves, so its
 *     JS download happens in parallel with the profile query instead of
 *     starting only *after* the gate passes (saves ~300-1500ms on cold loads).
 *   - We skip the pets query when account_type is known and not pet_parent —
 *     orgs/breeders/vets don't need it to pass the gate.
 */
export const FirstRunGate = ({ children }: { children: ReactNode }) => {
  const { pathname } = useLocation();
  const { user, loading: authLoading } = useAuth();
  const { data: profile, isLoading: profileLoading } = useProfile();

  // Only fetch pets when the user is (or might be) a pet_parent — saves a
  // round-trip for every other role.
  const accountType = profile?.account_type;
  const needsPets = !accountType || accountType === "pet_parent";
  const { data: pets, isLoading: petsLoading } = usePets(undefined, { enabled: needsPets });

  // Warm the PetParentHome chunk as soon as we have a signed-in user — most
  // users land there, and we'd rather pay the network cost in parallel with
  // the profile query than serially after the gate passes.
  useEffect(() => {
    if (user) {
      import("@/pages/home/PetParentHome").catch(() => {});
    }
  }, [user]);

  // 1. Wait for auth to resolve before any navigation decision.
  if (authLoading) {
    if (import.meta.env.DEV) console.info("[FirstRunGate] waiting on auth");
    return <HomeSkeleton />;
  }

  // 2. Not signed in.
  if (!user) {
    // If it's a public route, just render the children
    if (isPublicRoute(pathname)) {
      if (import.meta.env.DEV) console.info("[FirstRunGate] public route allowed:", pathname);
      return <>{children}</>;
    }

    const seenIntro = typeof window !== "undefined" && localStorage.getItem(SEEN_KEY);
    if (!seenIntro) {
      if (import.meta.env.DEV) console.info("[FirstRunGate] no user, no intro → /welcome");
      return <Navigate to="/welcome" replace />;
    }
    if (import.meta.env.DEV) console.info("[FirstRunGate] no user → /auth");
    return <Navigate to={`/auth?redirect=${encodeURIComponent(pathname)}`} replace />;
  }

  // 3. Wait on profile/pets data.
  if (profileLoading || (needsPets && petsLoading)) {
    return <HomeSkeleton />;
  }

  // 4. Profile incomplete → onboarding.
  //    Only pet_parent accounts require ≥1 pet; every other role (breeder, kennel,
  //    shelter, sanctuary, zoo, rescuer, buyer, vet, provider, …) just needs a
  //    completed profile to proceed.
  const profileMissing = !profile?.full_name?.trim() || !profile?.onboarded;
  const isPetParent = (profile?.account_type ?? "pet_parent") === "pet_parent";
  const noPets = !pets || pets.length === 0;
  const petGateFailed = isPetParent && noPets;
  if (profileMissing || petGateFailed) {
    if (import.meta.env.DEV)
      console.info("[FirstRunGate] incomplete → /onboarding", {
        profileMissing,
        petGateFailed,
        accountType: profile?.account_type,
      });
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
};
