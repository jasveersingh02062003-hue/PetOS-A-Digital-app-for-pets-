import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Printer, Heart, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

interface DonationRow {
  id: string;
  amount_inr: number;
  message: string | null;
  anonymous: boolean;
  status: string;
  created_at: string;
  paid_at: string | null;
  donor_pan: string | null;
  tax_receipt_number: string | null;
  receipt_issued_at: string | null;
  org_user_id: string;
  donor_id: string | null;
  donor: { full_name: string | null; email: string | null } | null;
  org: { full_name: string | null; account_type: string | null } | null;
}

export default function DonationReceipt() {
  const { donationId = "" } = useParams<{ donationId: string }>();
  const nav = useNavigate();
  const [d, setD] = useState<DonationRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("donations")
        .select("*, donor:donor_id(full_name, email), org:org_user_id(full_name, account_type)")
        .eq("id", donationId)
        .maybeSingle();
      setD(data as any);
      setLoading(false);
    })();
  }, [donationId]);

  if (loading) return <div className="min-h-screen grid place-items-center text-muted-foreground">Loading…</div>;
  if (!d) return <div className="min-h-screen grid place-items-center text-muted-foreground">Receipt not found.</div>;

  const formatINR = (v: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(v);
  const date = new Date(d.receipt_issued_at ?? d.paid_at ?? d.created_at).toLocaleDateString("en-IN", { dateStyle: "long" });
  const orgLabel = d.org?.account_type === "zoo" ? "Zoo / Wildlife Park" : d.org?.account_type === "sanctuary" ? "Sanctuary / Gaushala" : "Animal Shelter";

  return (
    <div className="min-h-screen bg-muted/20 pad-bottom-safe">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-hairline print:hidden">
        <div className="container-app h-14 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => nav(-1)}><ArrowLeft className="h-5 w-5" /></Button>
          <div className="flex-1"><h1 className="font-semibold">Donation Receipt</h1></div>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="h-4 w-4 mr-1.5" /> Save as PDF
          </Button>
        </div>
      </header>

      <main className="container-app py-6 max-w-xl mx-auto">
        <div className="bg-card rounded-2xl border border-hairline shadow-sm p-6 sm:p-8 space-y-6 print:shadow-none print:border-0">
          <div className="flex items-start justify-between border-b border-hairline pb-4">
            <div>
              <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                <Heart className="h-5 w-5 text-coral" fill="currentColor" /> Petos
              </h2>
              <p className="text-xs text-muted-foreground mt-1">Charitable donation receipt · For tax purposes</p>
            </div>
            <div className="text-right text-xs">
              <div className="font-semibold text-base">RECEIPT</div>
              <div className="font-mono text-muted-foreground mt-1">{d.tax_receipt_number ?? d.id.slice(0, 8)}</div>
              <div className="text-muted-foreground">{date}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-muted-foreground text-xs uppercase tracking-wide">Donated by</div>
              <div className="font-medium">{d.anonymous ? "Anonymous" : d.donor?.full_name ?? "Donor"}</div>
              {!d.anonymous && d.donor?.email && (
                <div className="text-xs text-muted-foreground">{d.donor.email}</div>
              )}
              {d.donor_pan && (
                <div className="text-xs text-muted-foreground mt-0.5">PAN: <span className="font-mono">{d.donor_pan}</span></div>
              )}
            </div>
            <div>
              <div className="text-muted-foreground text-xs uppercase tracking-wide">Donated to</div>
              <div className="font-medium">{d.org?.full_name ?? "Organization"}</div>
              <div className="text-xs text-muted-foreground">{orgLabel}</div>
            </div>
          </div>

          <div className="border border-hairline rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                <tr><th className="text-left py-2.5 px-3">Description</th><th className="text-right py-2.5 px-3">Amount</th></tr>
              </thead>
              <tbody>
                <tr className="border-t border-hairline">
                  <td className="py-3 px-3">
                    Voluntary donation
                    {d.message && <div className="text-xs text-muted-foreground italic mt-0.5">"{d.message}"</div>}
                  </td>
                  <td className="py-3 px-3 text-right font-medium">{formatINR(d.amount_inr)}</td>
                </tr>
                <tr className="border-t border-hairline bg-muted/30 font-semibold">
                  <td className="py-3 px-3">Total received</td>
                  <td className="py-3 px-3 text-right">{formatINR(d.amount_inr)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-3 text-xs text-emerald-900">
            <div className="font-semibold mb-1">80G Tax exemption</div>
            <p className="leading-relaxed">
              This donation may be eligible for tax deduction under section 80G of the Income Tax Act, 1961, subject to the recipient organisation's 80G registration. Please confirm 80G status with the organisation before claiming.
            </p>
          </div>

          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground border-t border-hairline pt-4">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
            Issued by Petos on behalf of {d.org?.full_name ?? "the organisation"}
          </div>
        </div>

        <p className="text-[11px] text-center text-muted-foreground mt-4 print:hidden">
          Tap "Save as PDF" to download. Keep this receipt for your records.
        </p>
      </main>
    </div>
  );
}
