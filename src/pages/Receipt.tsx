import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Printer, Download, ShieldCheck, BadgeCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface IntentRow {
  id: string;
  receipt_number: string | null;
  kind: string;
  amount_inr: number;
  refunded_amount_inr: number;
  status: string;
  currency: string;
  price_id: string | null;
  created_at: string;
  refunded_at: string | null;
  refund_reason: string | null;
  user_id: string;
}

const KIND_LABEL: Record<string, string> = {
  vet_consult: "AI Vet Consult",
  mating_listing: "Mating Listing",
  missing_listing: "Missing Pet Boost",
  agreement: "Service Agreement",
};

export default function Receipt() {
  const { intentId = "" } = useParams<{ intentId: string }>();
  const nav = useNavigate();
  const { user } = useAuth();
  const [intent, setIntent] = useState<IntentRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("payment_intents")
        .select("*")
        .eq("id", intentId)
        .maybeSingle();
      setIntent(data as IntentRow | null);
      setLoading(false);
    })();
  }, [intentId]);

  if (loading) return <div className="min-h-screen grid place-items-center text-muted-foreground">Loading…</div>;
  if (!intent) return <div className="min-h-screen grid place-items-center text-muted-foreground">Receipt not found.</div>;

  const formatINR = (v: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(v);
  const date = new Date(intent.created_at).toLocaleString("en-IN", { dateStyle: "long", timeStyle: "short" });
  const isRefunded = intent.status === "refunded";
  const productLabel = KIND_LABEL[intent.kind] ?? intent.price_id ?? intent.kind;

  return (
    <div className="min-h-screen bg-muted/20 pad-bottom-safe">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-hairline print:hidden">
        <div className="container-app h-14 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => nav(-1)}><ArrowLeft className="h-5 w-5" /></Button>
          <div className="flex-1"><h1 className="font-semibold">Receipt</h1></div>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="h-4 w-4 mr-1.5" /> Save as PDF
          </Button>
        </div>
      </header>

      <main className="container-app py-6 max-w-xl mx-auto">
        <div className="bg-card rounded-2xl border border-hairline shadow-sm p-6 sm:p-8 space-y-6 print:shadow-none print:border-0">
          <div className="flex items-start justify-between border-b border-hairline pb-4">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Petos</h2>
              <p className="text-xs text-muted-foreground">India · GSTIN pending</p>
            </div>
            <div className="text-right text-xs">
              <div className="font-semibold text-base">RECEIPT</div>
              <div className="font-mono text-muted-foreground mt-1">{intent.receipt_number ?? intent.id.slice(0, 8)}</div>
              <div className="text-muted-foreground">{date}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-muted-foreground text-xs uppercase tracking-wide">Billed to</div>
              <div className="font-medium">{user?.email ?? "—"}</div>
            </div>
            <div>
              <div className="text-muted-foreground text-xs uppercase tracking-wide">Payment status</div>
              <div className={`inline-flex items-center gap-1.5 font-semibold ${isRefunded ? "text-amber-600" : "text-emerald-600"}`}>
                <BadgeCheck className="h-4 w-4" /> {isRefunded ? "Refunded" : "Paid"}
              </div>
            </div>
          </div>

          <div className="border border-hairline rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                <tr><th className="text-left py-2.5 px-3">Item</th><th className="text-right py-2.5 px-3">Amount</th></tr>
              </thead>
              <tbody>
                <tr className="border-t border-hairline">
                  <td className="py-3 px-3">{productLabel}</td>
                  <td className="py-3 px-3 text-right font-medium">{formatINR(intent.amount_inr)}</td>
                </tr>
                {isRefunded && intent.refunded_amount_inr > 0 && (
                  <tr className="border-t border-hairline text-amber-700">
                    <td className="py-3 px-3">Refund {intent.refund_reason ? `(${intent.refund_reason})` : ""}</td>
                    <td className="py-3 px-3 text-right">−{formatINR(intent.refunded_amount_inr)}</td>
                  </tr>
                )}
                <tr className="border-t border-hairline bg-muted/30 font-semibold">
                  <td className="py-3 px-3">Total</td>
                  <td className="py-3 px-3 text-right">{formatINR(Math.max(0, intent.amount_inr - intent.refunded_amount_inr))}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground border-t border-hairline pt-4">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
            Securely processed by Stripe · This is your official Petos receipt
          </div>
        </div>

        <p className="text-[11px] text-center text-muted-foreground mt-4 print:hidden">
          Tap "Save as PDF" to download. To request a refund, open the related booking.
        </p>
      </main>
    </div>
  );
}