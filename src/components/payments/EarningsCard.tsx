import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { IndianRupee, TrendingUp } from "lucide-react";

type Row = {
  id: string;
  kind: string;
  gross_inr: number;
  commission_inr: number;
  net_inr: number;
  status: string;
  created_at: string;
};

export function EarningsCard() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    let active = true;
    (async () => {
      const { data } = await supabase
        .from("provider_payouts")
        .select("id, kind, gross_inr, commission_inr, net_inr, status, created_at")
        .eq("provider_user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (active) {
        setRows((data ?? []) as Row[]);
        setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [user?.id]);

  const totalNet = rows.reduce((s, r) => s + (r.net_inr ?? 0), 0);
  const totalGross = rows.reduce((s, r) => s + (r.gross_inr ?? 0), 0);
  const totalCommission = rows.reduce((s, r) => s + (r.commission_inr ?? 0), 0);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <Card className="p-3 rounded-2xl border-hairline shadow-none">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Earned</div>
          <div className="font-display text-xl mt-1 flex items-center gap-0.5">
            <IndianRupee className="h-3.5 w-3.5" />{totalNet.toLocaleString("en-IN")}
          </div>
        </Card>
        <Card className="p-3 rounded-2xl border-hairline shadow-none">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Gross</div>
          <div className="font-display text-xl mt-1 flex items-center gap-0.5">
            <IndianRupee className="h-3.5 w-3.5" />{totalGross.toLocaleString("en-IN")}
          </div>
        </Card>
        <Card className="p-3 rounded-2xl border-hairline shadow-none">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Fees</div>
          <div className="font-display text-xl mt-1 flex items-center gap-0.5">
            <IndianRupee className="h-3.5 w-3.5" />{totalCommission.toLocaleString("en-IN")}
          </div>
        </Card>
      </div>

      <Card className="rounded-2xl border-hairline shadow-none">
        <div className="px-4 py-3 border-b border-hairline flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          <div className="font-medium text-sm">Recent payouts</div>
        </div>
        {loading ? (
          <div className="p-6 text-center text-sm text-muted-foreground">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">No earnings yet.</div>
        ) : (
          <ul className="divide-y divide-hairline">
            {rows.map((r) => (
              <li key={r.id} className="px-4 py-3 flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium capitalize">{r.kind.replace("_", " ")}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {new Date(r.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                    {" · ₹"}{r.gross_inr} gross · ₹{r.commission_inr} fee
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-display text-base">₹{r.net_inr.toLocaleString("en-IN")}</div>
                  <Badge variant={r.status === "paid" ? "default" : "secondary"} className="text-[10px] mt-0.5">
                    {r.status}
                  </Badge>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}