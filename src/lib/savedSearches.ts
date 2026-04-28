/**
 * Saved searches — small localStorage-backed favourites for the Search page.
 * Each entry stores the query and the active tab so users can re-open
 * a refined view in one tap.
 *
 * Kept independent of the existing recent-searches store so the two can
 * evolve separately (recents = ephemeral, saved = curated).
 */
const KEY = "petos:saved_searches";
const MAX = 12;

export type SavedSearch = {
  id: string;          // stable id (timestamp-based)
  q: string;
  tab: string;         // search tab key ("all", "pets", …)
  saved_at: number;    // epoch ms
};

function read(): SavedSearch[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function write(list: SavedSearch[]) {
  try { localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX))); } catch {}
}

function sameKey(a: { q: string; tab: string }, b: { q: string; tab: string }) {
  return a.q.trim().toLowerCase() === b.q.trim().toLowerCase()
    && a.tab === b.tab;
}

export function listSavedSearches(): SavedSearch[] {
  return read().sort((a, b) => b.saved_at - a.saved_at);
}

export function isSearchSaved(q: string, tab: string): boolean {
  if (!q.trim()) return false;
  return read().some((s) => sameKey(s, { q, tab }));
}

export function saveSearch(q: string, tab: string): SavedSearch | null {
  const trimmed = q.trim();
  if (trimmed.length < 2) return null;
  const list = read();
  if (list.some((s) => sameKey(s, { q: trimmed, tab }))) return null;
  const entry: SavedSearch = {
    id: `s_${Date.now().toString(36)}`,
    q: trimmed,
    tab,
    saved_at: Date.now(),
  };
  write([entry, ...list]);
  return entry;
}

export function unsaveSearch(q: string, tab: string) {
  write(read().filter((s) => !sameKey(s, { q, tab })));
}

export function clearSavedSearches() {
  write([]);
}

export function clearRecentSearches() {
  try { localStorage.removeItem("petos:recent_searches"); } catch {}
}