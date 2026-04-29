import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  listSavedSearches,
  saveSearch,
  unsaveSearchById,
  touchSavedSearch,
  type SavedSearch,
  type SaveSearchInput,
} from "@/lib/savedSearches";

/**
 * Loads the current user's saved searches and exposes mutation helpers.
 * Auto-refetches via realtime when the table changes for this user.
 */
export function useSavedSearches() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const uid = user?.id;

  const query = useQuery({
    queryKey: ["saved-searches", uid],
    enabled: !!uid,
    queryFn: listSavedSearches,
  });

  useEffect(() => {
    if (!uid) return;
    const ch = supabase
      .channel(`saved-searches-${uid}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "saved_searches", filter: `user_id=eq.${uid}` },
        () => qc.invalidateQueries({ queryKey: ["saved-searches", uid] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [uid, qc]);

  const create = useMutation({
    mutationFn: (input: SaveSearchInput) => saveSearch(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["saved-searches", uid] }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => unsaveSearchById(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["saved-searches", uid] }),
  });

  const touch = useMutation({
    mutationFn: (id: string) => touchSavedSearch(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["saved-searches", uid] }),
  });

  return {
    items: (query.data ?? []) as SavedSearch[],
    isLoading: query.isLoading,
    create,
    remove,
    touch,
  };
}

/**
 * For each saved search of scope "mates" or "search", count pet_listings
 * created after the saved search's last_seen_at that match its filters.
 * Returns a map of saved_search_id -> new_match_count.
 */
export function useNewMatchCounts(searches: SavedSearch[]) {
  return useQuery({
    queryKey: ["saved-searches-new-counts", searches.map((s) => `${s.id}:${s.last_seen_at}`).join("|")],
    enabled: searches.length > 0,
    queryFn: async () => {
      const counts: Record<string, number> = {};
      await Promise.all(
        searches.map(async (s) => {
          let q = supabase
            .from("pet_listings")
            .select("id", { count: "exact", head: true })
            .eq("active", true)
            .gt("created_at", s.last_seen_at);
          const f = s.filters ?? {};
          if (f.species) q = q.eq("species", f.species);
          if (f.breed) q = q.ilike("breed", `%${f.breed}%`);
          if (f.city) q = q.ilike("city", `%${f.city}%`);
          if (f.listing_type) q = q.eq("listing_type", f.listing_type);
          if (f.gender) q = q.eq("gender", f.gender);
          const { count } = await q;
          counts[s.id] = count ?? 0;
        }),
      );
      return counts;
    },
    staleTime: 60_000,
  });
}