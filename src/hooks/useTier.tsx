import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { getStripeEnvironment } from "@/lib/stripe";

export type Tier = "free" | "plus";

/**
 * Single source of truth for the user's plan tier.
 * Reads from the `subscriptions` table (RLS scopes to self).
 * Defaults to "free" when no row exists.
 */
export const useTier = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["tier", user?.id],
    enabled: !!user?.id,
    staleTime: 60_000,
    queryFn: async (): Promise<{
      tier: Tier;
      status: string | null;
      currentPeriodEnd: string | null;
      cancelAtPeriodEnd: boolean;
    }> => {
      const env = getStripeEnvironment();
      // Server-authoritative Plus check
      const { data: isActive } = await supabase.rpc("has_active_subscription", {
        user_uuid: user!.id,
        check_env: env,
      });
      // Pull display fields (period end, cancel flag) from latest row in same env
      const { data } = await supabase
        .from("subscriptions")
        .select("status, current_period_end, cancel_at_period_end")
        .eq("user_id", user!.id)
        .eq("environment", env)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return {
        tier: isActive ? "plus" : "free",
        status: data?.status ?? null,
        currentPeriodEnd: data?.current_period_end ?? null,
        cancelAtPeriodEnd: data?.cancel_at_period_end ?? false,
      };
    },
  });
};
