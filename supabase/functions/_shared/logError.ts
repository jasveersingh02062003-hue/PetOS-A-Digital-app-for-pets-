import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

// Strip obvious PII before persisting.
function scrub(s: string): string {
  return s
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[email]")
    .replace(/\+?\d[\d\s().-]{8,}\d/g, "[phone]")
    .slice(0, 2000);
}

export async function logEdgeError(
  fnName: string,
  err: unknown,
  ctx: { user_id?: string | null; route?: string | null; meta?: Record<string, unknown> } = {}
) {
  try {
    const message = err instanceof Error ? err.message : typeof err === "string" ? err : "Unknown error";
    const stack = err instanceof Error ? err.stack ?? null : null;
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
    await admin.from("error_log").insert({
      source: `edge:${fnName}`,
      route: ctx.route ?? null,
      message: scrub(message),
      stack: stack ? scrub(stack).slice(0, 8000) : null,
      meta: ctx.meta ?? null,
      user_id: ctx.user_id ?? null,
    });
  } catch {
    // swallow
  }
}

export async function recordCronRun(
  jobName: string,
  status: "ok" | "error",
  error?: string,
) {
  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
    await admin.from("cron_health").upsert({
      job_name: jobName,
      last_run_at: new Date().toISOString(),
      last_status: status,
      last_error: error ? scrub(error) : null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "job_name" });
  } catch {
    // swallow
  }
}
