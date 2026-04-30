import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { logEdgeError } from "../_shared/logError.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code")?.trim().toUpperCase();
    if (!code || code.length !== 8) {
      return json({ error: "Invalid code" }, 400);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: grant, error: gErr } = await admin
      .from("vet_access_grants")
      .select("id, pet_id, code, expires_at, vet_name, clinic_name, scope, revoked")
      .eq("code", code)
      .eq("revoked", false)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    if (gErr) throw gErr;
    if (!grant) return json({ error: "Code not found or expired" }, 404);

    const scope: string[] = Array.isArray((grant as any).scope) ? (grant as any).scope : [];
    const allow = (s: string) => scope.length === 0 || scope.includes(s);

    const tasks: Array<Promise<any>> = [
      admin.from("pets").select("id,name,species,breed,date_of_birth,gender,weight_kg,avatar_url,vaccination_verified,allergies,conditions,microchip_id").eq("id", grant.pet_id).maybeSingle(),
    ];
    if (allow("vax")) tasks.push(admin.from("vaccinations").select("*").eq("pet_id", grant.pet_id).order("administered_on", { ascending: false }));
    else tasks.push(Promise.resolve({ data: [] }));
    if (allow("records")) tasks.push(admin.from("health_records").select("*").eq("pet_id", grant.pet_id).order("occurred_on", { ascending: false }));
    else tasks.push(Promise.resolve({ data: [] }));
    if (allow("symptoms")) tasks.push(admin.from("symptom_logs").select("*").eq("pet_id", grant.pet_id).order("logged_at", { ascending: false }).limit(20));
    else tasks.push(Promise.resolve({ data: [] }));
    if (allow("vitals")) tasks.push(admin.from("nutrition_logs").select("*").eq("pet_id", grant.pet_id).order("fed_at", { ascending: false }).limit(20));
    else tasks.push(Promise.resolve({ data: [] }));

    const [{ data: pet }, { data: vaccinations }, { data: records }, { data: symptoms }, { data: nutrition }] = await Promise.all(tasks);

    // Audit: record this view (best-effort, do not fail the request)
    try {
      const ip = req.headers.get("x-forwarded-for") ?? "";
      const ipHash = ip ? await sha256Hex(ip.split(",")[0].trim()) : null;
      await admin.from("vet_access_views").insert({
        grant_id: (grant as any).id,
        section: "vault",
        ip_hash: ipHash,
      });
    } catch (_) { /* ignore audit failures */ }

    return json({
      grant: { expires_at: grant.expires_at, vet_name: grant.vet_name, clinic_name: grant.clinic_name, scope },
      pet,
      vaccinations: vaccinations ?? [],
      records: records ?? [],
      symptoms: symptoms ?? [],
      nutrition: nutrition ?? [],
    });
  } catch (e) {
    console.error(e);
    await logEdgeError("vault-view", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
