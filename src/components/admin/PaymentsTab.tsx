import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Loader2, FileText, IndianRupee } from "lucide-react";
import { RefundButton } from "@/components/payments/RefundButton";

const STATUS_TINT: Record<string, string> = {
  paid: "bg-emerald-500/15 text-emerald-700",
  pending: "bg-amber-500/15 text-amber-700",
  failed: "bg-destructive/15 text-destructive",
  refunded: "bg-muted text-muted-foreground",
  beta_free: "bg-primary/10 text-primary",
};

export function PaymentsTab() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [kindFilter, setKindFilter] = useState<string>("");
  const [q, setQ] = useState("");

  const load = async () => {
    setLoading(true);
    let query = supabase
      .from("payment_intents")
      .select("id, created_at, status, kind, amount_inr, currency, refunded_amount_inr, receipt_number, user_id, ref_id, price_id")
      .order("created_at", { ascending: false })
      .limit(200);
    if (statusFilter) query = query.eq("status", statusFilter as any);
    if (kindFilter) query = query.eq("kind", kindFilter as any);
    if (q.trim()) query = query.or(`receipt_number.ilike.%${q.trim()}%,id.eq.${q.trim()}`);
    const { data } = await query;
    setRows(data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [statusFilter, kindFilter]);

  const totals = rows.reduce(
    (acc, r) => {
      if (r.status === "paid") acc.paid += r.amount_inr ?? 0;
      if (r.status === "refunded") acc.refunded += r.refunded_amount_inr ?? 0;
      return acc;
    },
    { paid: 0, refunded: 0 },
  );

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <Card className="p-3 flex items-center gap-2">
          <IndianRupee className="h-4 w-4 text-emerald-600" />
          <div>
            <div className="text-[11px] text-muted-foreground">Collected (visible)</div>
            <div className="font-display text-lg">₹{totals.paid.toLocaleString("en-IN")}</div>
          </div>
        </Card>
        <Card className="p-3 flex items-center gap-2">
          <IndianRupee className="h-4 w-4 text-muted-foreground" />
          <div>
            <div className="text-[11px] text-muted-foreground">Refunded</div>
            <div className="font-display text-lg">₹{totals.refunded.toLocaleString("en-IN")}</div>
          </div>
        </Card>
      </div>

      <div className="flex flex-wrap gap-2">
        <Input
          placeholder="Receipt # or intent id"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") load(); }}
          className="flex-1 min-w-[180px]"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-9 px-2 rounded-lg border border-hairline bg-background text-sm"
        >
          <option value="">All statuses</option>
          {["paid", "pending", "failed", "refunded", "beta_free"].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select
          value={kindFilter}
          onChange={(e) => setKindFilter(e.target.value)}
          className="h-9 px-2 rounded-lg border border-hairline bg-background text-sm"
        >
          <option value="">All kinds</option>
          {["transport","appointment","service","shop","mating","mating_listing","missing_listing","vet_consult","subscription","donation","boost","agreement"].map((k) => <option key={k} value={k}>{k}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="grid place-items-center py-10"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : rows.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-12">No payments match.</p>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <Card key={r.id} className="p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[10px] rounded-full px-2 py-0.5 font-medium capitalize ${STATUS_TINT[r.status] ?? "bg-muted"}`}>{r.status}</span>
                    <Badge variant="outline" className="capitalize text-[10px]">{r.kind}</Badge>
                    {r.receipt_number && <span className="font-mono text-[11px] text-muted-foreground">{r.receipt_number}</span>}
                  </div>
                  <div className="mt-1 text-sm font-medium">
                    ₹{(r.amount_inr ?? 0).toLocaleString("en-IN")}
                    {r.refunded_amount_inr ? <span className="text-xs text-muted-foreground ml-2">refunded ₹{r.refunded_amount_inr.toLocaleString("en-IN")}</span> : null}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    {new Date(r.created_at).toLocaleString()} · user {r.user_id?.slice(0, 8)}…
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Button asChild size="sm" variant="outline">
                    <Link to={`/receipt/${r.id}`}>
                      <FileText className="h-3.5 w-3.5" />
                    </Link>
                  </Button>
                  {r.status === "paid" && (
                    <RefundButton intentId={r.id} amountInr={r.amount_inr ?? 0} onRefunded={load} />
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}