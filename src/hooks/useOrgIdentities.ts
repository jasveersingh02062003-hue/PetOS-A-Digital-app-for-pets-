import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type OrgIdentity = {
  user_id: string;
  org_name: string | null;
  logo_url: string | null;
  status: string | null;
};

/**
 * Single shared, cached lookup of org identities keyed by user_id.
 * Used by AuthorIdentity to render org name + logo for breeder/kennel/shelter/sanctuary/zoo
 * accounts instead of the personal name.
 *
 * Returns a Map for O(1) lookup. Same caching pattern as useVerifiedOrgs / usePublicProfiles.
 */
export const useOrgIdentities = () =>
  useQuery({
    queryKey: ["org-identities"],
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("org_profiles")
        .select("user_id, org_name, facility_photos, status");
      if (error) throw error;
      const map = new Map<string, OrgIdentity>();
      for (const row of (data ?? []) as any[]) {
        map.set(row.user_id, {
          user_id: row.user_id,
          org_name: row.org_name ?? null,
          logo_url: Array.isArray(row.facility_photos) && row.facility_photos.length > 0
            ? row.facility_photos[0]
            : null,
          status: row.status ?? null,
        });
      }
      return map;
    },
  });

export const useOrgIdentity = (userId?: string | null) => {
  const { data } = useOrgIdentities();
  if (!userId) return undefined;
  return data?.get(userId);
};