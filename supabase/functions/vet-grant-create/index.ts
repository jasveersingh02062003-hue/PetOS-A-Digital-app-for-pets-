// Server-side vet share-code generator. Only the pet's owner may create a code.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function code8(): string {
  // 8 alphanumeric chars from a CSPRNG, no confusable chars.
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const buf = new Uint8Array(8);
  crypto.getRandomValues(buf);
  let s = "";
  for (let i = 0; i < 8; i++) s += chars[buf[i] % chars.length];
  return s;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "unauthenticated" }, 401);
    }
    const body = await req.json().catch(() => ({}));
    const petId = String(body?.petId ?? "");
    if (!UUID_RE.test(petId)) return json({ error: "invalid petId" }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userRes } = await supabase.auth.getUser();
    const uid = userRes?.user?.id;
    if (!uid) return json({ error: "unauthenticated" }, 401);

    // Ownership check via RLS — owner-only SELECT will succeed.
    const { data: pet, error: pErr } = await supabase
      .from("pets").select("id, owner_id").eq("id", petId).maybeSingle();
    if (pErr || !pet) return json({ error: "pet not found" }, 404);
    if (pet.owner_id !== uid) return json({ error: "forbidden" }, 403);

    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    // Try a few times in the (vanishingly rare) event of a code collision.
    for (let attempt = 0; attempt < 4; attempt++) {
      const code = code8();
      const { data, error } = await supabase
        .from("vet_access_grants")
        .insert({ pet_id: petId, code, expires_at: expires, created_by: uid })
        .select("code, expires_at").single();
      if (!error && data) return json({ code: data.code, expires_at: data.expires_at });
      if (error && !`${error.message}`.toLowerCase().includes("duplicate")) {
        return json({ error: error.message }, 400);
      }
    }
    return json({ error: "could not allocate code" }, 500);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "unknown" }, 500);
  }
});

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
