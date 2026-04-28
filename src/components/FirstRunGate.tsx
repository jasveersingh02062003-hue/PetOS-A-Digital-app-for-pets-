import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useProfile, usePets } from "@/hooks/useProfile";
import { Loader2 } from "lucide-react";

const SEEN_KEY = "petos_seen_intro";

/**
 * Gates the main tab routes. Order matters — never navigate while loading.
 *   1. authLoading → spinner
 *   2. !user → /welcome (first device visit) or /auth?redirect=…
 *   3. user but profile/pets loading → spinner
 *   4. profile incomplete → /onboarding
 *   5. else → render children
 */
export const FirstRunGate = ({ children }: { children: ReactNode }) => {
  const { pathname } = useLocation();
  const { user, loading: authLoading } = useAuth();
  const { data: profile, isLoading: profileLoading } = useProfile();
  const { data: pets, isLoading: petsLoading } = usePets();

  // 1. Wait for auth to resolve before any navigation decision.
  if (authLoading) {
    if (import.meta.env.DEV) console.info("[FirstRunGate] waiting on auth");
    return <Spinner />;
  }

  // 2. Not signed in.
  if (!user) {
    const seenIntro = typeof window !== "undefined" && localStorage.getItem(SEEN_KEY);
    if (!seenIntro) {
      if (import.meta.env.DEV) console.info("[FirstRunGate] no user, no intro → /welcome");
      return <Navigate to="/welcome" replace />;
    }
    if (import.meta.env.DEV) console.info("[FirstRunGate] no user → /auth");
    return <Navigate to={`/auth?redirect=${encodeURIComponent(pathname)}`} replace />;
  }

  // 3. Wait on profile/pets data.
  if (profileLoading || petsLoading) {
    return <Spinner />;
  }

  // 4. Profile incomplete → onboarding.
  const profileMissing = !profile?.full_name?.trim() || !profile?.onboarded;
  const noPets = !pets || pets.length === 0;
  if (profileMissing || noPets) {
    if (import.meta.env.DEV) console.info("[FirstRunGate] incomplete → /onboarding", { profileMissing, noPets });
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
};

const Spinner = () => (
  <div className="min-h-screen grid place-items-center">
    <Loader2 className="h-5 w-5 animate-spin text-primary" />
  </div>
);
