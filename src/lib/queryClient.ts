import { QueryClient } from "@tanstack/react-query";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { get, set, del } from "idb-keyval";
import { logError } from "./logError";

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

/** Keys we never want to persist (volatile / large / sensitive). */
const NON_PERSISTED_PREFIXES = [
  "realtime",
  "ephemeral",
  "presence",
  "typing",
  "upload",
  "stream",
];

/** Hard size cap to keep IndexedDB sane. */
const MAX_PERSISTED_BYTES = 4 * 1024 * 1024; // 4MB

export const queryClient = new QueryClient({
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