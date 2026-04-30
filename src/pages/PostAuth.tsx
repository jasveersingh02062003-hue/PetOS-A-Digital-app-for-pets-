import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Single-purpose router after any successful auth (email or OAuth).
 * Decides where to send the user based on session + profile completeness.
 */
export default function PostAuth() {
  const nav = useNavigate();
  const [params] = useSearchParams();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: sessionRes } = await supabase.auth.getSession();
      const session = sessionRes.session;
      if (!session) {
        if (!cancelled) nav("/auth", { replace: true });
        return;
      }
      const userId = session.user.id;

      const [{ data: profile }, { data: pets }] = await Promise.all([
        supabase
          .from("profiles")
          .select("full_name, onboarded, account_type")
          .eq("id", userId)
          .maybeSingle(),
        supabase.from("pets").select("id").eq("owner_id", userId).limit(1),
      ]);

      const accountType = (profile?.account_type ?? "pet_parent") as string;
      const isPetParent = accountType === "pet_parent";
      const profileMissing = !profile?.full_name?.trim() || !profile?.onboarded;
      const petGateFailed = isPetParent && (!pets || pets.length === 0);
      const incomplete = profileMissing || petGateFailed;
      if (import.meta.env.DEV) {
        console.info("[PostAuth] decision", { incomplete, hasProfile: !!profile, pets: pets?.length, accountType });
      }

      const redirect = params.get("redirect");
      if (cancelled) return;
      if (incomplete) {
        nav("/onboarding", { replace: true });
        return;
      }
      // Returning users: providers go to their dedicated dashboard, everyone else to home.
      if (redirect) nav(redirect, { replace: true });
      else if (accountType === "provider") nav("/provider", { replace: true });
      else nav("/", { replace: true });
    })();
    return () => {
      cancelled = true;
    };
  }, [nav, params]);

  return (
    <div className="min-h-[100dvh] grid place-items-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Setting things up…</p>
      </div>
    </div>
  );
}
