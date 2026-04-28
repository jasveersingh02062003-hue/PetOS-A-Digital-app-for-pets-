import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

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
      .select("*")
      .eq("code", code)
      .eq("revoked", false)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    if (gErr) throw gErr;
    if (!grant) return json({ error: "Code not found or expired" }, 404);

    const [{ data: pet }, { data: vaccinations }, { data: records }, { data: symptoms }, { data: nutrition }] = await Promise.all([
      admin.from("pets").select("id,name,species,breed,date_of_birth,gender,weight_kg,avatar_url,vaccination_verified").eq("id", grant.pet_id).maybeSingle(),
      admin.from("vaccinations").select("*").eq("pet_id", grant.pet_id).order("administered_on", { ascending: false }),
      admin.from("health_records").select("*").eq("pet_id", grant.pet_id).order("occurred_on", { ascending: false }),
      admin.from("symptom_logs").select("*").eq("pet_id", grant.pet_id).order("logged_at", { ascending: false }).limit(20),
      admin.from("nutrition_logs").select("*").eq("pet_id", grant.pet_id).order("fed_at", { ascending: false }).limit(20),
    ]);

    return json({
      grant: { expires_at: grant.expires_at, vet_name: grant.vet_name, clinic_name: grant.clinic_name },
      pet,
      vaccinations: vaccinations ?? [],
      records: records ?? [],
      symptoms: symptoms ?? [],
      nutrition: nutrition ?? [],
    });
  } catch (e) {
    console.error(e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
