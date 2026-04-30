import { useEffect, useState } from "react";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Lock } from "lucide-react";
import { PAYMENTS_ENABLED } from "@/lib/featureFlags";

interface Props {
  priceId?: string;
  quantity?: number;
  customerEmail?: string;
  userId?: string;
  returnUrl: string;
  kind?: string;
  refId?: string;
  amountInr?: number;
  productName?: string;
  currency?: string;
  onMeta?: (meta: { productName: string; amount: number | null; currency: string; interval: string | null }) => void;
}

export function StripeEmbeddedCheckout({ priceId, quantity, customerEmail, userId, returnUrl, kind, refId, amountInr, productName, currency, onMeta }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => { setReady(false); setError(null); }, [priceId, amountInr, productName]);

  // Payments are temporarily disabled via featureFlags.PAYMENTS_ENABLED.
  // All Stripe code below is preserved — flip the flag back to re-enable.
  if (!PAYMENTS_ENABLED) {
    return (
      <div className="rounded-2xl border border-hairline bg-muted/30 p-6 text-center space-y-3">
        <div className="mx-auto h-10 w-10 rounded-full bg-muted grid place-items-center">
          <Lock className="h-5 w-5 text-muted-foreground" />
        </div>
        <div className="font-display text-lg">Payments are temporarily unavailable</div>
        <p className="text-sm text-muted-foreground">
          We've paused checkout while we polish things up. You can keep using
          all the free features — paid plans will be back soon.
        </p>
      </div>
    );
  }

  const fetchClientSecret = async (): Promise<string> => {
    const { data, error } = await supabase.functions.invoke("payments-create-checkout", {
      body: { priceId, quantity, customerEmail, userId, returnUrl, kind, refId, amountInr, productName, currency, environment: getStripeEnvironment() },
    });
    if (error || !data?.clientSecret) {
      const msg = error?.message || data?.error || "Failed to start checkout";
      setError(msg);
      throw new Error(msg);
    }
    if (onMeta) onMeta({
      productName: data.productName ?? "",
      amount: data.amount ?? null,
      currency: data.currency ?? "inr",
      interval: data.interval ?? null,
    });
    setReady(true);
    return data.clientSecret;
  };

  if (error) {
    return (
      <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        {error}
      </div>
    );
  }

  return (
    <div className="relative min-h-[420px]">
      {!ready && (
        <div className="absolute inset-0 grid place-items-center text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      )}
      <EmbeddedCheckoutProvider stripe={getStripe()} options={{ fetchClientSecret }}>
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  );
}