import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-petos-signature",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: corsHeaders });

  const secret = Deno.env.get("INSURANCE_PARTNER_SECRET");
  if (!secret) {
    return new Response(JSON.stringify({ error: "webhook_not_configured" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const sig = req.headers.get("x-petos-signature");
  if (!sig || sig !== secret) {
    return new Response(JSON.stringify({ error: "invalid_signature" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: any;
  try { body = await req.json(); } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { lead_id, partner_ref, premium_inr, status, notes, policy_number, expires_on } = body ?? {};
  if (!lead_id && !partner_ref) {
    return new Response(JSON.stringify({ error: "missing_lead_id_or_partner_ref" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const patch: any = {};
  if (status) patch.status = status;
  if (premium_inr != null) patch.premium_inr = Number(premium_inr);
  if (partner_ref) patch.partner_ref = String(partner_ref);
  if (notes) patch.notes = String(notes);
  if (policy_number) patch.policy_number = String(policy_number);
  if (expires_on) patch.expires_on = String(expires_on);

  let q = supabase.from("insurance_leads").update(patch);
  q = lead_id ? q.eq("id", lead_id) : q.eq("partner_ref", partner_ref);
  const { data, error } = await q
    .select("id,status,premium_inr,commission_inr,pet_id,policy_number,partner_id")
    .maybeSingle();

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // If the policy was bound, write the active policy back onto the pet so the
  // UI can switch from "lead pending" to "active" and unlock claim filing.
  if (data && status === "bound" && data.pet_id) {
    let providerName: string | null = null;
    if (data.partner_id) {
      const { data: partner } = await supabase
        .from("insurance_partners")
        .select("name")
        .eq("id", data.partner_id)
        .maybeSingle();
      providerName = partner?.name ?? null;
    }
    await supabase
      .from("pets")
      .update({
        insurance_provider: providerName,
        insurance_policy: policy_number ?? data.policy_number ?? null,
      })
      .eq("id", data.pet_id);
  }

  return new Response(JSON.stringify({ ok: true, lead: data }), {
    status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});