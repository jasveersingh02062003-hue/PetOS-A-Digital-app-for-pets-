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
    const kind: string | undefined = body?.kind;
    const refId: string | undefined = body?.refId;
    const amountInr: number | undefined = body?.amountInr;
    const productName: string | undefined = body?.productName;
    const currencyIn: string = (body?.currency ?? "inr").toLowerCase();
    const environment: StripeEnv = body?.environment === "live" ? "live" : "sandbox";

    const useDynamic = !priceId && typeof amountInr === "number" && amountInr > 0 && !!productName;
    if (!useDynamic) {
      if (!priceId || !/^[a-zA-Z0-9_-]+$/.test(priceId)) {
        return new Response(JSON.stringify({ error: "invalid priceId" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }
    if (!returnUrl) {
      return new Response(JSON.stringify({ error: "returnUrl required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stripe = createStripeClient(environment);
    let lineItem: any;
    let isRecurring = false;
    let resolvedAmount: number | null = null;
    let resolvedCurrency = currencyIn;
    let resolvedInterval: string | null = null;
    let resolvedProductName = productName ?? "";

    if (useDynamic) {
      // amountInr is in rupees; Stripe wants paise (smallest unit)
      const unitAmount = Math.round(amountInr! * 100);
      lineItem = {
        price_data: {
          currency: resolvedCurrency,
          product_data: { name: productName! },
          unit_amount: unitAmount,
        },
        quantity: Math.max(1, quantity),
      };
      resolvedAmount = unitAmount;
    } else {
      const prices = await stripe.prices.list({ lookup_keys: [priceId!], expand: ["data.product"] });
      if (!prices.data.length) {
        return new Response(JSON.stringify({ error: "price not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const stripePrice = prices.data[0];
      isRecurring = stripePrice.type === "recurring";
      lineItem = { price: stripePrice.id, quantity: Math.max(1, quantity) };
      resolvedAmount = stripePrice.unit_amount;
      resolvedCurrency = stripePrice.currency;
      resolvedInterval = stripePrice.recurring?.interval ?? null;
      const product = stripePrice.product as { name?: string } | string;
      resolvedProductName = typeof product === "object" && product?.name ? product.name : "";
    }

    const session = await stripe.checkout.sessions.create({
      line_items: [lineItem],
      mode: isRecurring ? "subscription" : "payment",
      ui_mode: "embedded",
      return_url: returnUrl,
      ...(customerEmail && { customer_email: customerEmail }),
      metadata: {
        ...(userId && { userId }),
        ...(priceId && { priceId }),
        ...(kind && { kind }),
        ...(refId && { refId }),
      },
      ...(isRecurring && {
        subscription_data: {
          metadata: {
            ...(userId && { userId }),
            ...(priceId && { priceId }),
            ...(kind && { kind }),
            ...(refId && { refId }),
          },
        },
      }),
    });

    return new Response(
      JSON.stringify({
        clientSecret: session.client_secret,
        productName: resolvedProductName,
        amount: resolvedAmount,
        currency: resolvedCurrency,
        interval: resolvedInterval,
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