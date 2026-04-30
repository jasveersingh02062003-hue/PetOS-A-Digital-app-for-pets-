import { supabase } from "@/integrations/supabase/client";

/**
 * Lightweight, first-party product analytics.
 * Writes to public.analytics_events. RLS allows insert by anyone (including
 * anon visitors), but only staff can read events back.
 *
 * Usage:
 *   track("page_view", { route: "/feed" });
 *   track("post_create", { has_image: true });
 *
 * Rules:
 *   - Never put PII in props (no emails, phone numbers, free-text input).
 *   - Keep event names short and stable; prefer snake_case.
 *
 * Phase 10 — consent gating:
 *   - Honors window.localStorage["petos.consent"] === "granted".
 *   - Honors navigator.doNotTrack === "1" (auto-opt-out).
 *   - Until consent is granted, all calls to track() are no-ops.
 */

const SESSION_KEY = "petos.session_id";
const CONSENT_KEY = "petos.consent";

/** Returns true when the user has explicitly granted analytics consent. */
export function hasAnalyticsConsent(): boolean {
  if (typeof window === "undefined") return false;
  if (typeof navigator !== "undefined" && navigator.doNotTrack === "1") return false;
  try {
    return window.localStorage.getItem(CONSENT_KEY) === "granted";
  } catch {
    return false;
  }
}

export function setAnalyticsConsent(granted: boolean): void {
  try {
    window.localStorage.setItem(CONSENT_KEY, granted ? "granted" : "denied");
  } catch { /* private mode */ }
}

export function getStoredConsent(): "granted" | "denied" | null {
  if (typeof window === "undefined") return null;
  try {
    const v = window.localStorage.getItem(CONSENT_KEY);
    return v === "granted" || v === "denied" ? v : null;
  } catch {
    return null;
  }
}

let cachedSession: string | null = null;

function getSessionId(): string {
  if (cachedSession) return cachedSession;
  if (typeof window === "undefined") return "ssr";
  let id = sessionStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    try { sessionStorage.setItem(SESSION_KEY, id); } catch { /* private mode */ }
  }
  cachedSession = id;
  return id;
}

// Coalesce events fired in the same tick to a single network call.
type Pending = { event: string; route: string | null; props: Record<string, unknown> | null; user_id: string | null };
let queue: Pending[] = [];
let flushTimer: number | null = null;

async function flush() {
  flushTimer = null;
  if (!queue.length) return;
  const batch = queue;
  queue = [];
  const sid = getSessionId();
  try {
    await supabase.from("analytics_events").insert(
      batch.map((e) => ({
        user_id: e.user_id ?? undefined,
        session_id: sid,
        event: e.event,
        route: e.route ?? undefined,
        props: (e.props ?? null) as any,
      })),
    );
  } catch {
    // analytics is best-effort; never throw
  }
}

export async function track(
  event: string,
  props: Record<string, unknown> = {},
): Promise<void> {
  if (typeof window === "undefined") return;
  if (!hasAnalyticsConsent()) return;
  let user_id: string | null = null;
  try {
    const { data } = await supabase.auth.getUser();
    user_id = data?.user?.id ?? null;
  } catch { /* ignore */ }

  queue.push({
    event: event.slice(0, 60),
    route: window.location.pathname,
    props: Object.keys(props).length ? props : null,
    user_id,
  });

  if (flushTimer === null) {
    flushTimer = window.setTimeout(flush, 250);
  }
}

/**
 * Page-view tracker. Call once per route change.
 * Safe to invoke from a top-level effect.
 */
export function trackPageView() {
  if (typeof window === "undefined") return;
  void track("page_view");
}