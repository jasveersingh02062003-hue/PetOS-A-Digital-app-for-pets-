import { useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, ShieldCheck, Lock, Sparkles, BadgeCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { StripeEmbeddedCheckout } from "@/components/checkout/StripeEmbeddedCheckout";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";

const PRODUCT_LABELS: Record<string, { title: string; tagline: string }> = {
  petos_plus_monthly: { title: "Petos Plus", tagline: "Monthly membership — cancel anytime" },
  petos_plus_yearly: { title: "Petos Plus (Yearly)", tagline: "Save ~16% vs monthly" },
  vet_consult_one: { title: "AI Vet Consult", tagline: "One detailed consult with full pet history" },
  missing_boost_one: { title: "Missing Pet Boost", tagline: "10x reach for 48 hours" },
  mating_listing_one: { title: "Mating Listing", tagline: "30-day featured listing" },
  ngo_donation_min: { title: "NGO Donation", tagline: "Support verified pet welfare NGOs" },
};

export default function Checkout() {
  const nav = useNavigate();
  const { priceId = "" } = useParams<{ priceId: string }>();
  const [params] = useSearchParams();
  const { user } = useAuth();
  const [meta, setMeta] = useState<{ productName: string; amount: number | null; currency: string; interval: string | null } | null>(null);

  const isDynamic = priceId === "dynamic";
  const dynAmount = Number(params.get("amount") ?? 0);
  const dynName = params.get("name") ?? "Petos charge";
  const label = isDynamic
    ? { title: dynName, tagline: "Secure one-time payment" }
    : PRODUCT_LABELS[priceId] ?? { title: meta?.productName || "Checkout", tagline: "Secure payment" };

  const returnUrl = useMemo(() => {
    const next = params.get("next");
    const url = new URL(`${window.location.origin}/checkout/return`);
    url.searchParams.set("session_id", "{CHECKOUT_SESSION_ID}");
    url.searchParams.set("price_id", priceId);
    if (next) url.searchParams.set("next", next);
    return url.toString().replace(encodeURIComponent("{CHECKOUT_SESSION_ID}"), "{CHECKOUT_SESSION_ID}");
  }, [params, priceId]);

  const formattedPrice = meta?.amount != null
    ? new Intl.NumberFormat("en-IN", { style: "currency", currency: (meta.currency ?? "inr").toUpperCase(), maximumFractionDigits: 0 }).format(meta.amount / 100)
    : null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 pad-bottom-safe">
      <PaymentTestModeBanner />
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-hairline">
        <div className="container-app h-14 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => nav(-1)} aria-label="Back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <h1 className="font-semibold leading-none">Checkout</h1>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">Petos · {label.title}</p>
          </div>
        </div>
      </header>

      <main className="container-app py-5 space-y-4 max-w-xl mx-auto">
        {/* Product summary */}
        <section className="rounded-2xl border border-hairline bg-card p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">{label.title}</h2>
              <p className="text-sm text-muted-foreground mt-0.5">{label.tagline}</p>
            </div>
            {formattedPrice && (
              <div className="text-right">
                <div className="text-xl font-bold">{formattedPrice}</div>
                {meta?.interval && <div className="text-xs text-muted-foreground">/ {meta.interval}</div>}
              </div>
            )}
          </div>
        </section>

        {/* Trust badges */}
        <section className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl border border-hairline bg-card p-3">
            <Lock className="h-4 w-4 mx-auto text-emerald-600 mb-1" />
            <div className="text-[11px] font-medium leading-tight">256-bit secure</div>
          </div>
          <div className="rounded-xl border border-hairline bg-card p-3">
            <ShieldCheck className="h-4 w-4 mx-auto text-emerald-600 mb-1" />
            <div className="text-[11px] font-medium leading-tight">Powered by Stripe</div>
          </div>
          <div className="rounded-xl border border-hairline bg-card p-3">
            <BadgeCheck className="h-4 w-4 mx-auto text-emerald-600 mb-1" />
            <div className="text-[11px] font-medium leading-tight">Refundable</div>
          </div>
        </section>

        {/* Embedded Stripe checkout */}
        <section className="rounded-2xl border border-hairline bg-card p-2 sm:p-4 shadow-sm overflow-hidden">
          {priceId ? (
            <StripeEmbeddedCheckout
              priceId={isDynamic ? undefined : priceId}
              amountInr={isDynamic ? dynAmount : undefined}
              productName={isDynamic ? dynName : undefined}
              currency={isDynamic ? "inr" : undefined}
              customerEmail={user?.email ?? undefined}
              userId={user?.id}
              returnUrl={returnUrl}
              kind={params.get("kind") ?? undefined}
              refId={params.get("ref") ?? undefined}
              onMeta={setMeta}
            />
          ) : (
            <p className="p-6 text-center text-sm text-muted-foreground">Missing product reference.</p>
          )}
        </section>

        <p className="text-[11px] text-muted-foreground text-center px-4">
          By continuing you agree to Petos's Terms. Your card details are handled by Stripe — Petos never sees them.
        </p>
      </main>
    </div>
  );
}