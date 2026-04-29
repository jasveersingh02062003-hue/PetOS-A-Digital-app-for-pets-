import { useEffect, useState } from "react";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

interface Props {
  priceId: string;
  quantity?: number;
  customerEmail?: string;
  userId?: string;
  returnUrl: string;
  onMeta?: (meta: { productName: string; amount: number | null; currency: string; interval: string | null }) => void;
}

export function StripeEmbeddedCheckout({ priceId, quantity, customerEmail, userId, returnUrl, onMeta }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => { setReady(false); setError(null); }, [priceId]);

  const fetchClientSecret = async (): Promise<string> => {
    const { data, error } = await supabase.functions.invoke("payments-create-checkout", {
      body: { priceId, quantity, customerEmail, userId, returnUrl, environment: getStripeEnvironment() },
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