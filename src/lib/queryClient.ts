import { QueryClient, onlineManager, MutationCache } from "@tanstack/react-query";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { get, set, del, clear } from "idb-keyval";
import { logError } from "./logError";
import { toast } from "sonner";

/**
 * Phase 8 — query client + persistence.
 *
 * Persistence strategy:
 *  - Storage: IndexedDB via idb-keyval (no quota issues like localStorage's 5MB).
 *  - Buster: bumped on every deploy via VITE_BUILD_ID, plus a manual schema rev
 *    so old cached shapes are auto-evicted when query response shape changes.
 *  - maxAge: 24h. After that we re-fetch on cold start.
 *  - dehydrate filter: only persist successful queries, skip giant lists and
 *    anything keyed as `realtime:*` or `ephemeral:*` (presence, typing, etc).
 *  - mutations are NOT persisted (they replay on next session is dangerous).
 */

const SCHEMA_REV = "v1";
const BUILD_ID = (import.meta.env.VITE_BUILD_ID as string | undefined) ?? "dev";
export const PERSIST_BUSTER = `${SCHEMA_REV}:${BUILD_ID}`;
const IDB_KEY = "rq-cache";

/**
 * Phase 9 — bind onlineManager to navigator.onLine so paused mutations resume
 * automatically on reconnect, and queries don't fire while offline.
 */
if (typeof window !== "undefined" && typeof navigator !== "undefined") {
  onlineManager.setOnline(navigator.onLine);
  window.addEventListener("online", () => onlineManager.setOnline(true));
  window.addEventListener("offline", () => onlineManager.setOnline(false));
}

/**
 * Stale-time presets — pick one when calling useQuery to align with how often
 * the underlying data realistically changes. Keep call sites readable.
 */
export const STALE = {
  /** Volatile data (chat threads, presence). Always refetch on remount. */
  realtime: 0,
  /** Lists that change frequently (feed, notifications). 30s. */
  short: 30_000,
  /** Default — most reads. 1 min. */
  default: 60_000,
  /** Profile, pet card, services list. 5 min. */
  medium: 5 * 60_000,
  /** Catalog, breeds, static config. 1 hour. */
  long: 60 * 60_000,
  /** Truly immutable (e.g., a finalized order). */
  immutable: Number.POSITIVE_INFINITY,
} as const;

/** Keys we never want to persist (volatile / large / sensitive). */
const NON_PERSISTED_PREFIXES = [
  "realtime",
  "ephemeral",
  "presence",
  "typing",
  "upload",
  "stream",
  // Sets / Maps don't survive JSON serialization — refetch on cold start.
  "verified-orgs",
  "pending-orgs",
];

/** Hard size cap to keep IndexedDB sane. */
const MAX_PERSISTED_BYTES = 4 * 1024 * 1024; // 4MB

export const queryClient = new QueryClient({
  mutationCache: new MutationCache({
    onError: (error, _vars, _ctx, mutation) => {
      // Skip the toast if the call site provided its own onError handler —
      // they probably already showed a contextual error UI.
      if (mutation.options.onError) return;
      const msg =
        (error as { message?: string })?.message ||
        "Something went wrong. Please try again.";
      toast.error(msg.slice(0, 140));
    },
  }),
  defaultOptions: {
    queries: {
      // Phase 3 perf — most reads are not edited from other tabs in real time.
      // Realtime channels handle the few that are (messages, notifications).
      staleTime: 60_000,
      gcTime: 24 * 60 * 60_000, // 24h — required for persistence to be useful
      refetchOnWindowFocus: false,
      refetchOnReconnect: "always",
      retry: 1,
    },
    mutations: {
      onError: (err) => logError(err, { source: "client:mutation" }),
    },
  },
});

export const idbPersister = createAsyncStoragePersister({
  storage: {
    getItem: async (key) => {
      try {
        const v = await get(key);
        return (v as string) ?? null;
      } catch (e) {
        logError(e, { source: "persister:getItem" });
        return null;
      }
    },
    setItem: async (key, value) => {
      try {
        if (typeof value === "string" && value.length > MAX_PERSISTED_BYTES) {
          // Cache too big — drop persistence rather than OOM the device.
          await del(key);
          return;
        }
        await set(key, value);
      } catch (e) {
        logError(e, { source: "persister:setItem" });
      }
    },
    removeItem: async (key) => {
      try {
        await del(key);
      } catch (e) {
        logError(e, { source: "persister:removeItem" });
      }
    },
  },
  key: IDB_KEY,
  throttleTime: 1000,
});

import type { Query } from "@tanstack/react-query";

/** Dehydrate filter — decide what to write to disk. */
export function shouldPersistQuery(query: Query): boolean {
  if (query.state.status !== "success") return false;
  const head = query.queryKey?.[0] as unknown;
  if (typeof head === "string") {
    for (const p of NON_PERSISTED_PREFIXES) {
      if (head === p || head.startsWith(`${p}:`) || head.startsWith(`${p}/`)) return false;
    }
  }
  return true;
}

/**
 * Wipe the persisted cache. Call this on sign-out so the next user on the
 * same device doesn't see the previous user's hydrated data flash on screen
 * before the new fetch resolves.
 */
export async function clearPersistedCache(): Promise<void> {
  try {
    queryClient.clear();
    await del(IDB_KEY);
    // Also clear any orphaned legacy keys.
    await clear().catch(() => {});
  } catch (e) {
    logError(e, { source: "persister:clearPersistedCache" });
  }
}