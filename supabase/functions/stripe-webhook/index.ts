// Receives Stripe events and keeps the `subscriptions` table in sync.
// Public endpoint — must verify Stripe signature.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, stripe-signature",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY");
  const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!STRIPE_SECRET_KEY || !STRIPE_WEBHOOK_SECRET) {
    // Don't leak which one is missing
    return new Response("Webhook not configured", { status: 503 });
  }

  const sig = req.headers.get("stripe-signature");
  if (!sig) return new Response("Missing signature", { status: 400 });

  const body = await req.text();
  const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" });

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, sig, STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return new Response("Bad signature", { status: 400 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.client_reference_id ?? (session.metadata?.user_id as string | undefined);
        if (!userId) break;

        // Subscription checkout (Plus tier)
        if (session.mode === "subscription" && session.subscription) {
          const sub = await stripe.subscriptions.retrieve(session.subscription as string);
          await upsertSub(supabase, userId, sub);
          break;
        }

        // One-time payment checkout (mating_listing, missing_listing, agreement, vet_consult)
        if (session.mode === "payment") {
          const kind = session.metadata?.kind as string | undefined;
          const refId = (session.metadata?.ref_id as string | undefined) || null;
          const intentId = (session.metadata?.intent_id as string | undefined) || null;

          // Mark our internal payment_intent as paid
          if (intentId) {
            await supabase
              .from("payment_intents")
              .update({
                status: "paid",
                provider_session_id: session.id,
              })
              .eq("id", intentId);
          }

          // Apply side-effect per kind
          if (kind === "mating_listing" && refId) {
            const until = new Date();
            until.setDate(until.getDate() + 30);
            await supabase
              .from("mating_listings")
              .update({ active: true, paid_until: until.toISOString() })
              .eq("id", refId);
          } else if (kind === "missing_listing" && refId) {
            const until = new Date();
            until.setDate(until.getDate() + 7);
            await supabase
              .from("missing_pets")
              .update({ boosted_until: until.toISOString() })
              .eq("id", refId);
          } else if (kind === "donation") {
            const donationId = (session.metadata?.donation_id as string | undefined) || null;
            if (donationId) {
              await supabase
                .from("donations")
                .update({ status: "paid", paid_at: new Date().toISOString() })
                .eq("id", donationId);
            }
          }
        }
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.created": {
        const sub = event.data.object as Stripe.Subscription;
        const userId = (sub.metadata?.user_id as string | undefined) ?? null;
        if (!userId) break;
        await upsertSub(supabase, userId, sub);
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const userId = (sub.metadata?.user_id as string | undefined) ?? null;
        if (!userId) break;
        await supabase.from("subscriptions").upsert({
          user_id: userId,
          tier: "free",
          status: "canceled",
          provider: "stripe",
          provider_subscription_id: sub.id,
          provider_customer_id: typeof sub.customer === "string" ? sub.customer : sub.customer?.id ?? null,
          current_period_end: sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null,
          cancel_at_period_end: sub.cancel_at_period_end ?? false,
        }, { onConflict: "user_id" });
        break;
      }
      default:
        // Ignore the rest
        break;
    }
  } catch (e) {
    console.error("Webhook handler error:", e);
    return new Response("Handler error", { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { "Content-Type": "application/json" },
    status: 200,
  });
});

async function upsertSub(supabase: any, userId: string, sub: Stripe.Subscription) {
  const tier = sub.status === "active" || sub.status === "trialing" ? "plus" : "free";
  const status = mapStatus(sub.status);
  await supabase.from("subscriptions").upsert({
    user_id: userId,
    tier,
    status,
    provider: "stripe",
    provider_subscription_id: sub.id,
    provider_customer_id: typeof sub.customer === "string" ? sub.customer : sub.customer?.id ?? null,
    current_period_end: sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null,
    cancel_at_period_end: sub.cancel_at_period_end ?? false,
  }, { onConflict: "user_id" });
}

function mapStatus(s: Stripe.Subscription.Status): "active" | "past_due" | "canceled" | "trialing" {
  if (s === "active") return "active";
  if (s === "trialing") return "trialing";
  if (s === "past_due" || s === "unpaid") return "past_due";
  return "canceled";
}
