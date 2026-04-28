// One-time checkout for paid actions (vet consult, mating listing, agreement, missing listing).
// Today: returns { status: "beta_free", intent_id } so flows proceed free during Beta.
// Once STRIPE_SECRET_KEY + the matching STRIPE_PRICE_<KIND> are set, returns a real checkout URL.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type Kind = "vet_consult" | "mating_listing" | "agreement" | "missing_listing";

const PRICE_ENV: Record<Kind, string> = {
  vet_consult: "STRIPE_PRICE_VET_CONSULT",
  mating_listing: "STRIPE_PRICE_MATING_LISTING",
  agreement: "STRIPE_PRICE_AGREEMENT",
  missing_listing: "STRIPE_PRICE_MISSING_LISTING",
};

const AMOUNT_INR: Record<Kind, number> = {
  vet_consult: 199,
  mating_listing: 299,
  agreement: 99,
  missing_listing: 499,
};

const FREE_FOR_PLUS: Record<Kind, boolean> = {
  vet_consult: true,
  mating_listing: false,
  agreement: false,
  missing_listing: true,
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return jsonErr("unauthenticated", 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userRes } = await supabase.auth.getUser();
    if (!userRes?.user) return jsonErr("unauthenticated", 401);
    const userId = userRes.user.id;

    const body = await req.json().catch(() => ({}));
    const kind = body?.kind as Kind | undefined;
    const refId = (body?.ref_id ?? null) as string | null;
    if (!kind || !(kind in PRICE_ENV)) return jsonErr("invalid kind", 400);

    // Plus members get certain kinds free.
    const { data: subRow } = await supabase
      .from("subscriptions")
      .select("tier, status, current_period_end")
      .eq("user_id", userId)
      .maybeSingle();
    const isPlus =
      subRow?.tier === "plus" &&
      (subRow.status === "active" || subRow.status === "trialing") &&
      (!subRow.current_period_end || new Date(subRow.current_period_end) > new Date());

    if (isPlus && FREE_FOR_PLUS[kind]) {
      const { data: intent } = await supabase
        .from("payment_intents")
        .insert({
          user_id: userId,
          kind,
          amount_inr: 0,
          status: "paid",
          ref_id: refId,
        })
        .select("id")
        .single();
      return jsonOk({ status: "free_for_plus", intent_id: intent?.id ?? null });
    }

    const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY");
    const PRICE = Deno.env.get(PRICE_ENV[kind]);

    // Stripe not configured for this kind → Beta-free path.
    if (!STRIPE_SECRET_KEY || !PRICE) {
      const { data: intent } = await supabase
        .from("payment_intents")
        .insert({
          user_id: userId,
          kind,
          amount_inr: AMOUNT_INR[kind],
          status: "beta_free",
          ref_id: refId,
        })
        .select("id")
        .single();
      return jsonOk({ status: "beta_free", intent_id: intent?.id ?? null });
    }

    // Real checkout
    const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" });
    const origin = req.headers.get("origin") ?? new URL(req.url).origin;

    const { data: pendingIntent } = await supabase
      .from("payment_intents")
      .insert({
        user_id: userId,
        kind,
        amount_inr: AMOUNT_INR[kind],
        status: "pending",
        ref_id: refId,
      })
      .select("id")
      .single();

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{ price: PRICE, quantity: 1 }],
      client_reference_id: userId,
      customer_email: userRes.user.email ?? undefined,
      success_url: `${origin}/?paid=${kind}`,
      cancel_url: `${origin}/?cancelled=${kind}`,
      metadata: { user_id: userId, kind, ref_id: refId ?? "", intent_id: pendingIntent?.id ?? "" },
    });

    return jsonOk({ status: "checkout", url: session.url, intent_id: pendingIntent?.id ?? null });
  } catch (e) {
    console.error("create-one-time-checkout error:", e);
    return jsonErr(e instanceof Error ? e.message : "Unknown error", 500);
  }
});

function jsonOk(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
function jsonErr(error: string, status = 400) {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
