import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { ShieldCheck, AlertTriangle, Lock } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  listingId: string;
  listingTitle: string;
  fullPriceInr: number;
}

/**
 * Deposit-only checkout for breeder_sale listings.
 * The buyer pays a small holding deposit (default 10%) which is captured to
 * Petos as `puppy_sale` payment_intent. The remainder is settled offline at
 * pickup (cash / UPI to breeder) — Petos only takes commission on the deposit.
 */
export function PayDepositSheet({ open, onOpenChange, listingId, listingTitle, fullPriceInr }: Props) {
  const nav = useNavigate();
  const suggested = Math.max(500, Math.round(fullPriceInr * 0.1));
  const [amount, setAmount] = useState<number>(suggested);
  const min = 500;
  const max = Math.max(min, fullPriceInr);

  const proceed = () => {
    const safe = Math.min(Math.max(min, Math.round(amount || 0)), max);
    const qs = new URLSearchParams({
      kind: "puppy_sale",
      ref: listingId,
      amount: String(safe),
      name: `Holding deposit · ${listingTitle}`,
      next: `/mates/adopt/${listingId}`,
    });
    onOpenChange(false);
    nav(`/checkout/dynamic?${qs.toString()}`);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl max-h-[90vh] overflow-y-auto">
        <SheetHeader className="text-left">
          <SheetTitle className="font-display text-xl">Pay holding deposit</SheetTitle>
          <SheetDescription>
            Reserve {listingTitle} with a refundable holding deposit. The balance is paid in person on pickup.
          </SheetDescription>
        </SheetHeader>

        <Card className="rounded-2xl border-hairline p-3 my-4 flex gap-2 text-[12px] leading-relaxed bg-leaf/10">
          <ShieldCheck className="h-4 w-4 text-leaf shrink-0 mt-0.5" />
          <span>Only the deposit is captured by Petos. The breeder must hand over vaccination records, microchip, and the puppy in person before the balance is paid.</span>
        </Card>

        <div className="space-y-3 mb-4">
          <Label htmlFor="dep-amt" className="text-sm">Deposit amount (₹)</Label>
          <Input
            id="dep-amt"
            type="number"
            inputMode="numeric"
            min={min}
            max={max}
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
          />
          <div className="text-[11px] text-muted-foreground">
            Suggested: ₹{suggested.toLocaleString("en-IN")} (10% of ₹{fullPriceInr.toLocaleString("en-IN")}). Min ₹{min}.
          </div>
        </div>

        <Card className="rounded-2xl border-amber-500/30 bg-amber-500/10 p-3 mb-4 flex gap-2 text-[12px] leading-relaxed">
          <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
          <span>Never pay the full amount online. Always meet the breeder, see the puppy and verify documents before settling the balance.</span>
        </Card>

        <Button
          className="w-full rounded-xl h-12 gap-2"
          onClick={proceed}
          disabled={!amount || amount < min}
        >
          <Lock className="h-4 w-4" /> Pay ₹{(Math.min(Math.max(min, amount || 0), max)).toLocaleString("en-IN")} deposit
        </Button>
      </SheetContent>
    </Sheet>
  );
}