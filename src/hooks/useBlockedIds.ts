import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/** Returns the set of user IDs the current user has blocked. */
export function useBlockedIds() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["blocked-ids", user?.id],
    enabled: !!user,
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("blocked_users")
        .select("blocked_id")
        .eq("blocker_id", user!.id);
      return new Set((data ?? []).map((r: any) => r.blocked_id as string));
    },
  });
}

/** Helper: filter an array of items by author/owner id, removing blocked users. */
export function filterBlocked<T extends Record<string, any>>(
  items: T[] | undefined,
  blocked: Set<string> | undefined,
  authorKey: keyof T = "author_id" as keyof T
): T[] {
  if (!items) return [];
  if (!blocked || blocked.size === 0) return items;
  return items.filter((it) => !blocked.has(it[authorKey] as string));
}
