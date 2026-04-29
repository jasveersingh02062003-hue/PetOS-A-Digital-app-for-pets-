/**
 * Saved searches — DB-backed (table: saved_searches).
 * Each row belongs to a single user (RLS enforced) and stores a query, tab,
 * optional structured filters, and a last_seen_at timestamp used to compute
 * "new matches since last visit".
 *
 * Recent searches (ephemeral) still live in localStorage.
 */
import { supabase } from "@/integrations/supabase/client";

export type SavedSearch = {
  id: string;
  user_id: string;
  label: string;
  scope: string;       // "search" | "mates" | "breeders" | "shelters"
  q: string;
  tab: string;
  filters: Record<string, any>;
  last_seen_at: string;
  created_at: string;
  updated_at: string;
};

export type SaveSearchInput = {
  label: string;
  scope?: string;
  q?: string;
  tab?: string;
  filters?: Record<string, any>;
};

export async function listSavedSearches(): Promise<SavedSearch[]> {
  const { data, error } = await supabase
    .from("saved_searches")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as SavedSearch[];
}

export async function isSearchSaved(q: string, tab: string, scope = "search"): Promise<boolean> {
  const trimmed = (q ?? "").trim().toLowerCase();
  if (!trimmed) return false;
  const { data, error } = await supabase
    .from("saved_searches")
    .select("id, q, tab, scope")
    .eq("scope", scope)
    .eq("tab", tab)
    .ilike("q", trimmed)
    .limit(1);
  if (error) return false;
  return (data ?? []).some((r: any) => (r.q ?? "").trim().toLowerCase() === trimmed);
}

export async function saveSearch(input: SaveSearchInput): Promise<SavedSearch | null> {
  const { data: u } = await supabase.auth.getUser();
  const uid = u.user?.id;
  if (!uid) return null;
  const row = {
    user_id: uid,
    label: input.label,
    scope: input.scope ?? "search",
    q: (input.q ?? "").trim(),
    tab: input.tab ?? "all",
    filters: input.filters ?? {},
    last_seen_at: new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from("saved_searches")
    .insert(row)
    .select("*")
    .single();
  if (error) {
    // dedupe collision — return existing
    if ((error as any).code === "23505") return null;
    throw error;
  }
  return data as SavedSearch;
}

export async function unsaveSearchById(id: string): Promise<void> {
  const { error } = await supabase.from("saved_searches").delete().eq("id", id);
  if (error) throw error;
}

export async function unsaveSearch(q: string, tab: string, scope = "search"): Promise<void> {
  const trimmed = (q ?? "").trim();
  const { data } = await supabase
    .from("saved_searches")
    .select("id, q")
    .eq("scope", scope)
    .eq("tab", tab);
  const match = (data ?? []).find((r: any) => (r.q ?? "").trim().toLowerCase() === trimmed.toLowerCase());
  if (match) await unsaveSearchById(match.id);
}

export async function touchSavedSearch(id: string): Promise<void> {
  await supabase
    .from("saved_searches")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", id);
}

export function clearRecentSearches() {
  try { localStorage.removeItem("petos:recent_searches"); } catch {}
}