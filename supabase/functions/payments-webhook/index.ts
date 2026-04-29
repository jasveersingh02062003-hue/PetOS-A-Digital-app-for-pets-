// Stripe webhook handler — keeps `subscriptions` table in sync with Stripe.
// Public endpoint; signature verification is handled by Stripe-Signature header.
// Sandbox + Live both POST here with `?env=sandbox` or `?env=live`.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createStripeClient, type StripeEnv } from "../_shared/stripe.ts";

function getSupabase() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

function mapStatus(s: Stripe.Subscription.Status): string {
  if (s === "active") return "active";
  if (s === "trialing") return "trialing";
  if (s === "past_due" || s === "unpaid") return "past_due";
  return "canceled";
}

async function upsertSub(env: StripeEnv, sub: Stripe.Subscription) {
  const supabase = getSupabase();
  const userId = (sub.metadata?.userId as string | undefined)
    ?? (sub.metadata?.user_id as string | undefined);
  if (!userId) {
    console.warn("subscription event without user_id metadata", sub.id);
    return;
  }

  const item = sub.items?.data?.[0] as any;
  const priceId = item?.price?.lookup_key || item?.price?.metadata?.lovable_external_id || item?.price?.id || null;
  const productId = typeof item?.price?.product === "string" ? item.price.product : item?.price?.product?.id ?? null;
  const periodStart = item?.current_period_start ?? (sub as any).current_period_start;
  const periodEnd   = item?.current_period_end   ?? (sub as any).current_period_end;

  const status = mapStatus(sub.status);
  const tier = (status === "active" || status === "trialing") ? "plus" : "free";

  await supabase.from("subscriptions").upsert({
    user_id: userId,
    tier,
    status,
    provider: "stripe",
    environment: env,
    stripe_subscription_id: sub.id,
    stripe_customer_id: typeof sub.customer === "string" ? sub.customer : sub.customer?.id ?? null,
    provider_subscription_id: sub.id,
    provider_customer_id: typeof sub.customer === "string" ? sub.customer : sub.customer?.id ?? null,
    product_id: productId,
    price_id: priceId,
    current_period_start: periodStart ? new Date(periodStart * 1000).toISOString() : null,
    current_period_end:   periodEnd   ? new Date(periodEnd   * 1000).toISOString() : null,
    cancel_at_period_end: sub.cancel_at_period_end ?? false,
    updated_at: new Date().toISOString(),
  }, { onConflict: "stripe_subscription_id,environment" });
}

async function handleCheckoutCompleted(env: StripeEnv, session: Stripe.Checkout.Session) {
  const supabase = getSupabase();
  // For one-time payments, mark the payment_intent as paid (mark-paid is idempotent;
  // this is a safety net if client never lands on /checkout/return).
  const intentId = (session.metadata?.intent_id as string | undefined) || null;
  if (session.mode === "payment" && session.payment_status === "paid" && intentId) {
    await supabase
      .from("payment_intents")
      .update({ status: "paid", provider_session_id: session.id })
      .eq("id", intentId)
      .neq("status", "paid");
  }
}

async function handleEvent(env: StripeEnv, event: Stripe.Event) {
  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated":
      await upsertSub(env, event.data.object as Stripe.Subscription);
      break;
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      await getSupabase()
        .from("subscriptions")
        .update({
          tier: "free",
          status: "canceled",
          cancel_at_period_end: sub.cancel_at_period_end ?? false,
          current_period_end: sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null,
          updated_at: new Date().toISOString(),
        })
        .eq("stripe_subscription_id", sub.id)
        .eq("environment", env);
      break;
    }
    case "checkout.session.completed":
      await handleCheckoutCompleted(env, event.data.object as Stripe.Checkout.Session);
      break;
    default:
      console.log("unhandled event", event.type);
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("method not allowed", { status: 405 });

  const url = new URL(req.url);
  const rawEnv = url.searchParams.get("env");
  if (rawEnv !== "sandbox" && rawEnv !== "live") {
    return new Response(JSON.stringify({ received: true, ignored: "missing env" }), { status: 200 });
  }
  const env: StripeEnv = rawEnv;

  const sig = req.headers.get("stripe-signature");
  const body = await req.text();
  if (!sig) return new Response("missing signature", { status: 400 });

  const secret = env === "sandbox"
    ? Deno.env.get("STRIPE_SANDBOX_WEBHOOK_SECRET")
    : Deno.env.get("STRIPE_LIVE_WEBHOOK_SECRET");
  if (!secret) {
    console.error("webhook secret not configured for env=", env);
    return new Response("webhook not configured", { status: 503 });
  }

  // Use the Stripe SDK only for signature verification (no API calls).
  const stripe = new Stripe("sk_unused_for_verification_only", { apiVersion: "2024-06-20" });
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, sig, secret);
  } catch (e) {
    console.error("signature verify failed", e);
    return new Response("bad signature", { status: 400 });
  }

  try {
    await handleEvent(env, event);
  } catch (e) {
    console.error("handler error", e);
    return new Response("handler error", { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});