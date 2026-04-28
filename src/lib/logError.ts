import { supabase } from "@/integrations/supabase/client";

/**
 * Best-effort client-side error logger. Writes to public.error_log.
 * Never throws — failures are swallowed (we can't log a logging failure usefully).
 */
export async function logError(
  err: unknown,
  ctx: { source?: string; route?: string; meta?: Record<string, unknown> } = {}
) {
  try {
    const message =
      err instanceof Error ? err.message : typeof err === "string" ? err : "Unknown error";
    const stack = err instanceof Error ? err.stack ?? null : null;
    const route = ctx.route ?? (typeof window !== "undefined" ? window.location.pathname : null);

    const { data: userRes } = await supabase.auth.getUser();
    const user_id = userRes?.user?.id ?? null;

    await supabase.from("error_log").insert({
      source: ctx.source ?? "client",
      route,
      message: message.slice(0, 2000),
      stack: stack ? stack.slice(0, 8000) : null,
      meta: ctx.meta ?? null,
      user_id,
    });
  } catch {
    // swallow
  }
}
