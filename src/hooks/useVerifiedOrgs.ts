import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Returns a Set of user_ids whose org_profiles row is approved.
 * Used to flip the green "Verified" tick on SellerBadge for breeders / kennels / shelters / sanctuaries / rescuers / zoos.
 * Single shared query — cached for 5min so every component (PostFeed, profile headers, CommentSheet, Search, AdoptGrid)
 * shares the same fetch.
 */
export const useVerifiedOrgs = () =>
  useQuery({
    queryKey: ["verified-orgs"],
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("org_profiles")
        .select("user_id")
        .eq("status", "approved");
      if (error) throw error;
      return new Set<string>((data ?? []).map((r: any) => r.user_id));
    },
  });

export const useIsVerifiedOrg = (userId?: string | null) => {
  const { data } = useVerifiedOrgs();
  if (!userId) return false;
  return data instanceof Set ? data.has(userId) : false;
};

/**
 * Returns a Set of user_ids whose org_profiles row is pending (submitted but not yet approved).
 * Used to flip the amber "KYC pending" chip on SellerBadge.
 */
export const usePendingOrgs = () =>
  useQuery({
    queryKey: ["pending-orgs"],
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("org_profiles")
        .select("user_id")
        .eq("status", "pending");
      if (error) throw error;
      return new Set<string>((data ?? []).map((r: any) => r.user_id));
    },
  });

export const useIsPendingOrg = (userId?: string | null) => {
  const { data } = usePendingOrgs();
  if (!userId) return false;
  return data instanceof Set ? data.has(userId) : false;
};