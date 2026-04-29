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
    const body = await req.json().catch(() => ({}));
    const sessionId: string | undefined = body?.sessionId;
    const environment: StripeEnv = body?.environment === "live" ? "live" : "sandbox";
    if (!sessionId || !sessionId.startsWith("cs_")) return json({ error: "invalid sessionId" }, 400);

    const stripe = createStripeClient(environment);
    const session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ["payment_intent", "line_items.data.price"] });

    const userId = (session.metadata as Record<string, string> | null)?.userId ?? null;
    const priceLookupKey = (session.metadata as Record<string, string> | null)?.priceId ?? null;
    const kindMeta = (session.metadata as Record<string, string> | null)?.kind ?? null;
    const refIdMeta = (session.metadata as Record<string, string> | null)?.refId ?? null;
    const paid = session.payment_status === "paid" || session.status === "complete";
    const amountTotal = session.amount_total ?? 0;
    const currency = session.currency ?? "inr";
    const paymentIntentId = typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id ?? null;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Idempotent upsert by provider_session_id
    const { data: existing } = await supabase
      .from("payment_intents")
      .select("id, status, receipt_number")
      .eq("provider_session_id", sessionId)
      .maybeSingle();

    let intentId = existing?.id;
    let receiptNumber = existing?.receipt_number;

    if (!existing && userId) {
      const { data: ins } = await supabase
        .from("payment_intents")
        .insert({
          user_id: userId,
          kind: kindMeta || kindFromPriceId(priceLookupKey),
          ref_id: refIdMeta,
          amount_inr: Math.round(amountTotal / (currency === "inr" ? 100 : 100)),
          currency,
          price_id: priceLookupKey,
          status: paid ? "paid" : "pending",
          provider_session_id: sessionId,
          provider_payment_intent_id: paymentIntentId,
          metadata: { stripe_status: session.status, mode: session.mode },
        })
        .select("id, receipt_number")
        .single();
      intentId = ins?.id;
      receiptNumber = ins?.receipt_number;
    } else if (existing && paid && existing.status !== "paid") {
      const { data: upd } = await supabase
        .from("payment_intents")
        .update({ status: "paid", provider_payment_intent_id: paymentIntentId })
        .eq("id", existing.id)
        .select("receipt_number")
        .single();
      receiptNumber = upd?.receipt_number ?? receiptNumber;
    }

    // Stamp parent row when we have a ref linkage
    if (paid && intentId && kindMeta && refIdMeta) {
      const tableMap: Record<string, string> = {
        transport: "transport_bookings",
        service: "service_bookings",
        appointment: "appointments",
        shop: "shop_orders",
        mating: "mating_listings",
        vet_consult: "vet_consults",
      };
      const table = tableMap[kindMeta];
      if (table) {
        await supabase
          .from(table)
          .update({ payment_intent_id: intentId, paid_at: new Date().toISOString() })
          .eq("id", refIdMeta);
      }
    }

    return json({
      ok: true,
      paid,
      intentId,
      receiptNumber,
      amount: amountTotal,
      currency,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    console.error("payments-mark-paid error:", msg);
    return json({ error: msg }, 500);
  }
});

function kindFromPriceId(priceId: string | null): string {
  if (!priceId) return "vet_consult";
  if (priceId.startsWith("petos_plus")) return "vet_consult"; // subscription tracked separately
  if (priceId.startsWith("vet_consult")) return "vet_consult";
  if (priceId.startsWith("missing")) return "missing_listing";
  if (priceId.startsWith("mating")) return "mating_listing";
  return "agreement";
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}