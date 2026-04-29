import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Returns the human-readable category label for a service provider's primary
 * profile (e.g. "walker", "groomer", "trainer"). Returns null when not a
 * service provider or no provider row exists.
 */
export const useProviderCategory = (userId: string | undefined, enabled: boolean) => {
  const { data } = useQuery({
    queryKey: ["provider-category", userId],
    enabled: !!userId && enabled,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_providers")
        .select("category")
        .eq("owner_id", userId!)
        .eq("active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) return null;
      return (data?.category as string | undefined) ?? null;
    },
  });
  return data ?? null;
};

export default useProviderCategory;