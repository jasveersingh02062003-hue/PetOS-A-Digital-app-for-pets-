import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTier } from "@/hooks/useTier";
import { Loader2, Sparkles, Check, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

export type PaywallKind = "vet_consult" | "mating_listing" | "agreement" | "missing_listing";

const PRESETS: Record<PaywallKind, {
  title: string;
  amount: number;
  blurb: string;
  perks: string[];
  freeForPlus?: boolean;
  paymentKind?: "vet_consult" | "mating" | "missing_boost" | "agreement";
  productName?: string;
}> = {
  vet_consult: {
    title: "Connect with a vet",
    amount: 199,
    blurb: "A licensed vet replies in your chat — usually within 10 minutes. Notes go straight into your pet's vault.",
    perks: ["Real, verified vet", "Chat replies in minutes", "Prescription saved to vault"],
    freeForPlus: true,
    paymentKind: "vet_consult",
    productName: "AI Vet Consult",
  },
  mating_listing: {
    title: "Publish your mating listing",
    amount: 499,
    blurb: "A small one-time fee keeps the mating space serious — only verified, intentional listings get through.",
    perks: ["Verified-pets-only space", "Notify your local circle", "Edit anytime, no recurring fees"],
    paymentKind: "mating",
    productName: "Mating listing (30 days)",
  },
  agreement: {
    title: "Generate digital agreement",
    amount: 99,
    blurb: "A simple, signed record of your mating intent — protects both parties before any meeting.",
    perks: ["Both parties sign in-app", "Stored privately to both vaults", "Plain-language, no legalese"],
    paymentKind: "agreement",
    productName: "Digital mating agreement",
  },
  missing_listing: {
    title: "Send a city-wide alert",
    amount: 499,
    blurb: "We'll push your listing to every nearby pet parent and keep it pinned until found.",
    perks: ["Pushed to your whole city", "Sightings stream live", "Free to mark found anytime"],
    freeForPlus: true,
    paymentKind: "missing_boost",
    productName: "Missing pet city-wide boost",
  },
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: PaywallKind;
  /** Called after a successful "Beta-free" or paid checkout. Run the actual action here. */
  onConfirmed: (intentId: string) => Promise<void> | void;
  /** Optional ref id (consult id, listing id, etc.) for the ledger. */
  refId?: string | null;
};

/**
 * Universal one-time-payment gate.
 * - Plus tier: skips charge for kinds where freeForPlus = true.
 * - Stripe not configured: logs a "beta_free" payment_intent and lets the action proceed.
 * - Stripe configured: would route to checkout (TODO when secrets are added).
 */
export const PaywallSheet = ({ open, onOpenChange, kind, onConfirmed, refId }: Props) => {
  const nav = useNavigate();
  const { user } = useAuth();
  const { data: tier } = useTier();
  const [working, setWorking] = useState(false);
  const preset = PRESETS[kind];
  const isPlus = tier?.tier === "plus";
  const freeBecausePlus = isPlus && preset.freeForPlus;

  const proceed = async () => {
    if (!user) {
      onOpenChange(false);
      nav("/auth");
      return;
    }
    setWorking(true);
    try {
      // Try the checkout function. If Stripe isn't configured yet, fall back to Beta-free.
      const { data, error } = await supabase.functions.invoke("create-one-time-checkout", {
        body: { kind, ref_id: refId ?? null },
      });
      if (!error && (data?.status === "free_for_plus" || data?.status === "beta_free")) {
        toast.success(
          data.status === "free_for_plus"
            ? "Included with your Plus plan ✓"
            : "Free during Beta — thanks for being early.",
        );
        await onConfirmed(data.intent_id);
        setWorking(false);
        onOpenChange(false);
        return;
      }

      // Paid path: route through branded embedded checkout (/checkout/dynamic)
      const params = new URLSearchParams({
        kind: preset.paymentKind ?? "vet_consult",
        amount: String(preset.amount),
        name: preset.productName ?? preset.title,
      });
      if (refId) params.set("ref", refId);
      onOpenChange(false);
      nav(`/checkout/dynamic?${params.toString()}`);
      return;
    } catch (e: any) {
      toast.error(e?.message ?? "Something went wrong");
      setWorking(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl border-hairline px-5 pb-8 pt-6 max-h-[90vh] overflow-y-auto">
        <SheetHeader className="text-left">
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
            <Sparkles className="h-5 w-5 text-primary" strokeWidth={1.8} />
          </div>
          <SheetTitle className="font-display text-2xl">{preset.title}</SheetTitle>
          <SheetDescription className="text-sm">{preset.blurb}</SheetDescription>
        </SheetHeader>

        <ul className="mt-5 space-y-2.5">
          {preset.perks.map((p) => (
            <li key={p} className="flex items-start gap-2.5 text-sm">
              <span className="mt-0.5 h-4 w-4 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Check className="h-2.5 w-2.5 text-primary" strokeWidth={3} />
              </span>
              <span>{p}</span>
            </li>
          ))}
        </ul>

        <Card className="mt-5 rounded-2xl border-hairline shadow-none p-4 flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">One-time</div>
            <div className="font-display text-2xl mt-0.5">
              {freeBecausePlus ? (
                <span className="text-primary">Included</span>
              ) : (
                <>
                  ₹{preset.amount}
                  <span className="text-xs text-muted-foreground font-sans ml-1.5 line-through">
                    {/* visual hint that today is free */}
                  </span>
                </>
              )}
            </div>
          </div>
          <span className="text-[11px] uppercase tracking-wider bg-primary/10 text-primary px-2.5 py-1 rounded-full font-medium">
            {freeBecausePlus ? "Plus perk" : "Free during Beta"}
          </span>
        </Card>

        <Button
          className="w-full h-12 rounded-2xl mt-5"
          disabled={working}
          onClick={proceed}
        >
          {working ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Continue
        </Button>

        <div className="flex items-center justify-center gap-1.5 mt-3 text-[11px] text-muted-foreground">
          <ShieldCheck className="h-3 w-3" />
          No card needed today · Cancel anytime
        </div>
      </SheetContent>
    </Sheet>
  );
};
