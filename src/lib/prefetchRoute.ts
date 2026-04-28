/**
 * Prefetch helpers for lazy route chunks.
 * Triggered on hover / touchstart so the JS arrives before the navigation.
 * Each entry is a thunk returning the dynamic import promise — calling it
 * causes Vite to fetch the chunk; the browser caches it for the real nav.
 */
const map: Record<string, () => Promise<unknown>> = {
  "/discover": () => import("@/pages/Discover"),
  "/mates": () => import("@/pages/Mates"),
  "/health": () => import("@/pages/Health"),
  "/profile": () => import("@/pages/Profile"),
  "/services": () => import("@/pages/Services"),
  "/explore": () => import("@/pages/Explore"),
};

const fetched = new Set<string>();

export function prefetchRoute(path: string) {
  if (fetched.has(path)) return;
  const loader = map[path];
  if (!loader) return;
  fetched.add(path);
  // Best-effort: swallow errors; the real nav will surface them.
  loader().catch(() => fetched.delete(path));
}