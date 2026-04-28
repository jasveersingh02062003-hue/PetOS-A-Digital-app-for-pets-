import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

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
      const { data } = await supabase
        .from("subscriptions")
        .select("tier, status, current_period_end, cancel_at_period_end")
        .eq("user_id", user!.id)
        .maybeSingle();
      const isActive =
        data?.tier === "plus" &&
        (data.status === "active" || data.status === "trialing") &&
        (!data.current_period_end || new Date(data.current_period_end) > new Date());
      return {
        tier: isActive ? "plus" : "free",
        status: data?.status ?? null,
        currentPeriodEnd: data?.current_period_end ?? null,
        cancelAtPeriodEnd: data?.cancel_at_period_end ?? false,
      };
    },
  });
};
