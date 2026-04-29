import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { createStripeClient, type StripeEnv } from "../_shared/stripe.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);

    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await supabaseAuth.auth.getUser();
    if (!user) return json({ error: "unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const intentId: string | undefined = body?.intentId;
    const reason: string = (body?.reason ?? "requested_by_customer").toString().slice(0, 200);
    const environment: StripeEnv = body?.environment === "live" ? "live" : "sandbox";
    if (!intentId) return json({ error: "intentId required" }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: intent } = await supabase
      .from("payment_intents")
      .select("id, user_id, status, amount_inr, refunded_amount_inr, provider_payment_intent_id, currency")
      .eq("id", intentId)
      .maybeSingle();

    if (!intent) return json({ error: "intent not found" }, 404);
    if (intent.status !== "paid") return json({ error: "only paid intents are refundable" }, 400);
    if (!intent.provider_payment_intent_id) return json({ error: "no provider intent" }, 400);
    if (intent.user_id !== user.id) {
      // Allow admin role to refund any
      const { data: hasRole } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
      if (hasRole !== true) return json({ error: "forbidden" }, 403);
    }

    const stripe = createStripeClient(environment);
    const refund = await stripe.refunds.create({
      payment_intent: intent.provider_payment_intent_id,
      reason: ["duplicate", "fraudulent", "requested_by_customer"].includes(reason) ? reason as any : "requested_by_customer",
      metadata: { reason_text: reason, app_intent_id: intent.id },
    });

    const refundedAmount = (refund.amount ?? 0);
    const refundedInr = (intent.currency === "inr" || !intent.currency) ? Math.round(refundedAmount / 100) : Math.round(refundedAmount / 100);

    await supabase
      .from("payment_intents")
      .update({
        status: "refunded",
        refunded_amount_inr: refundedInr,
        refund_reason: reason,
        refunded_at: new Date().toISOString(),
      })
      .eq("id", intent.id);

    return json({ ok: true, refundId: refund.id, amount: refundedAmount });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    console.error("payments-refund error:", msg);
    return json({ error: msg }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}