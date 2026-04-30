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
 */

const SESSION_KEY = "petos.session_id";
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
        user_id: e.user_id,
        session_id: sid,
        event: e.event,
        route: e.route,
        props: e.props,
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