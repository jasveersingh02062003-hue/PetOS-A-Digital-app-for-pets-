// Signup rate-limit checker. Call BEFORE supabase.auth.signUp from the client.
// Limits: 3 attempts per email per hour, 10 per IP per hour.
// Uses service role to read/write public.signup_attempts.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EMAIL_LIMIT = 3;
const IP_LIMIT = 10;
const WINDOW_MS = 60 * 60 * 1000; // 1 hour

async function sha256(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { email } = await req.json();
    if (!email || typeof email !== "string") {
      return Response.json({ allowed: false, reason: "invalid_email" }, { headers: corsHeaders, status: 400 });
    }

    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("cf-connecting-ip") ||
      "unknown";

    const emailHash = await sha256(email.trim().toLowerCase());
    const ipHash = await sha256(ip);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const since = new Date(Date.now() - WINDOW_MS).toISOString();

    const [{ count: emailCount }, { count: ipCount }] = await Promise.all([
      supabase
        .from("signup_attempts")
        .select("id", { count: "exact", head: true })
        .eq("email_hash", emailHash)
        .gte("attempted_at", since),
      supabase
        .from("signup_attempts")
        .select("id", { count: "exact", head: true })
        .eq("ip_hash", ipHash)
        .gte("attempted_at", since),
    ]);

    if ((emailCount ?? 0) >= EMAIL_LIMIT) {
      return Response.json(
        { allowed: false, reason: "too_many_attempts_email", retry_after_min: 60 },
        { headers: corsHeaders, status: 429 },
      );
    }
    if ((ipCount ?? 0) >= IP_LIMIT) {
      return Response.json(
        { allowed: false, reason: "too_many_attempts_ip", retry_after_min: 60 },
        { headers: corsHeaders, status: 429 },
      );
    }

    // Record the attempt
    await supabase.from("signup_attempts").insert({ email_hash: emailHash, ip_hash: ipHash });

    // Best-effort housekeeping (1% of calls)
    if (Math.random() < 0.01) {
      await supabase.rpc("purge_old_signup_attempts").catch(() => {});
    }

    return Response.json({ allowed: true }, { headers: corsHeaders });
  } catch (err) {
    return Response.json(
      { allowed: true, error: (err as Error).message },
      { headers: corsHeaders, status: 200 }, // fail-open so we never block real users on infra errors
    );
  }
});
