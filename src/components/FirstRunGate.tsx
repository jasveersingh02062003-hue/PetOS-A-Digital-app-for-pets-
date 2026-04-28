import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useProfile, usePets } from "@/hooks/useProfile";
import { Loader2 } from "lucide-react";

/**
 * Gates the main tab routes. Order:
 *   1. First-ever visit (device) → /welcome
 *   2. Not signed in → /auth
 *   3. Signed in but profile incomplete (no name OR no pets OR onboarded=false) → /onboarding
 *   4. Otherwise → render tabs
 *
 * Why: the previous Home showed "Hello, F" because we never required a real name +
 * a pet before letting users land on the feed. First impressions decide retention.
 */
export const FirstRunGate = ({ children }: { children: ReactNode }) => {
  const { pathname } = useLocation();
  const { user, loading: authLoading } = useAuth();
  const { data: profile, isLoading: profileLoading } = useProfile();
  const { data: pets, isLoading: petsLoading } = usePets();

  // 1. Never seen the brand intro? Show the welcome reel first.
  if (typeof window !== "undefined" && !localStorage.getItem("petos_seen_intro")) {
    return <Navigate to="/welcome" replace />;
  }

  // 2. Not signed in → auth
  if (!authLoading && !user) {
    return <Navigate to={`/auth?redirect=${encodeURIComponent(pathname)}`} replace />;
  }

  // Wait for profile + pets to resolve before deciding (avoids redirect flicker)
  if (authLoading || profileLoading || petsLoading) {
    return (
      <div className="min-h-screen grid place-items-center">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  // 3. Profile incomplete → force onboarding
  const profileMissing = !profile?.full_name?.trim() || !profile?.onboarded;
  const noPets = !pets || pets.length === 0;
  if (profileMissing || noPets) {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
};
