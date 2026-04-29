import { createStripeClient, type StripeEnv } from "../_shared/stripe.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const priceId: string | undefined = body?.priceId;
    const quantity: number = Number(body?.quantity ?? 1);
    const customerEmail: string | undefined = body?.customerEmail;
    const userId: string | undefined = body?.userId;
    const returnUrl: string | undefined = body?.returnUrl;
    const environment: StripeEnv = body?.environment === "live" ? "live" : "sandbox";

    if (!priceId || !/^[a-zA-Z0-9_-]+$/.test(priceId)) {
      return new Response(JSON.stringify({ error: "invalid priceId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!returnUrl) {
      return new Response(JSON.stringify({ error: "returnUrl required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stripe = createStripeClient(environment);
    const prices = await stripe.prices.list({ lookup_keys: [priceId], expand: ["data.product"] });
    if (!prices.data.length) {
      return new Response(JSON.stringify({ error: "price not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const stripePrice = prices.data[0];
    const isRecurring = stripePrice.type === "recurring";

    const session = await stripe.checkout.sessions.create({
      line_items: [{ price: stripePrice.id, quantity: Math.max(1, quantity) }],
      mode: isRecurring ? "subscription" : "payment",
      ui_mode: "embedded",
      return_url: returnUrl,
      ...(customerEmail && { customer_email: customerEmail }),
      ...(userId && {
        metadata: { userId, priceId },
        ...(isRecurring && { subscription_data: { metadata: { userId, priceId } } }),
      }),
    });

    const product = stripePrice.product as { name?: string } | string;
    const productName = typeof product === "object" && product?.name ? product.name : "";

    return new Response(
      JSON.stringify({
        clientSecret: session.client_secret,
        productName,
        amount: stripePrice.unit_amount,
        currency: stripePrice.currency,
        interval: stripePrice.recurring?.interval ?? null,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    console.error("payments-create-checkout error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});