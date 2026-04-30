import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserLocation } from "@/hooks/useUserLocation";

/**
 * Wraps a "discover_*" RPC with the user's best-known location.
 * Returns results sorted by composite_score (nearest + best first).
 * Falls back gracefully when location is unavailable.
 */
export function useNearbyQuery<T = any>(
  rpcName: "discover_providers" | "discover_mating_listings" | "discover_shop_products" | "discover_pets_for_adoption",
  params: Record<string, any> = {},
  options: { enabled?: boolean } = {}
) {
  const { coords } = useUserLocation();
  const args = { _lat: coords?.lat ?? null, _lng: coords?.lng ?? null, ...params };

  return useQuery({
    queryKey: [rpcName, args],
    enabled: options.enabled ?? true,
    queryFn: async (): Promise<T[]> => {
      const { data, error } = await supabase.rpc(rpcName as any, args);
      if (error) throw error;
      return (data ?? []) as T[];
    },
  });
}