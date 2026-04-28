// Creates a Stripe Checkout Session for Petos Plus subscriptions.
// If Stripe secrets are not yet configured, returns { status: "not_configured" }
// so the UI can show the calm "launching soon" state instead of failing.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY");
    const PRICE_MONTHLY = Deno.env.get("STRIPE_PRICE_PLUS_MONTHLY");
    const PRICE_YEARLY = Deno.env.get("STRIPE_PRICE_PLUS_YEARLY");

    // Auth check first — even before checking Stripe config, so unauthenticated
    // requests don't probe our configuration.
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return jsonErr("unauthenticated", 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userRes } = await supabase.auth.getUser();
    if (!userRes?.user) return jsonErr("unauthenticated", 401);

    // Calm placeholder mode — Stripe not yet configured.
    if (!STRIPE_SECRET_KEY || !PRICE_MONTHLY || !PRICE_YEARLY) {
      return new Response(JSON.stringify({ status: "not_configured" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const body = await req.json().catch(() => ({}));
    const plan = body?.plan;
    if (plan !== "plus_monthly" && plan !== "plus_yearly") return jsonErr("invalid plan", 400);
    const price = plan === "plus_yearly" ? PRICE_YEARLY : PRICE_MONTHLY;

    const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" });

    const origin = req.headers.get("origin") ?? new URL(req.url).origin;
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price, quantity: 1 }],
      client_reference_id: userRes.user.id,
      customer_email: userRes.user.email ?? undefined,
      success_url: `${origin}/plus/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/plus`,
      allow_promotion_codes: true,
      metadata: { user_id: userRes.user.id, plan },
      subscription_data: { metadata: { user_id: userRes.user.id, plan } },
      automatic_tax: { enabled: true },
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (e) {
    console.error("create-checkout error:", e);
    return jsonErr(e instanceof Error ? e.message : "Unknown error", 500);
  }
});

function jsonErr(error: string, status = 400) {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
