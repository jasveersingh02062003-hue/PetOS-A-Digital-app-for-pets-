import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Returns the set of user_ids that have at least one "helpful" vet answer
 * (i.e. helpful_count >= 1 on a vet_answers row they authored).
 * Used to surface a "Helpful vet" ribbon next to the role chip in AuthorIdentity.
 * One shared cached fetch — no per-row queries.
 */
export const useHelpfulVetIds = () =>
  useQuery({
    queryKey: ["helpful-vet-ids"],
    staleTime: 10 * 60_000,
    gcTime: 30 * 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("vet_answers")
        .select("user_id, helpful_count")
        .gte("helpful_count", 1);
      return new Set<string>((data ?? []).map((r: any) => r.user_id));
    },
  });

export const useIsHelpfulVet = (userId?: string | null) => {
  const { data } = useHelpfulVetIds();
  if (!userId) return false;
  return data?.has(userId) ?? false;
};