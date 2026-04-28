import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Loader2, Plus, Wallet, Check, X } from "lucide-react";
import { format } from "date-fns";

type PaymentKind = "stud_fee" | "pick_of_litter" | "deposit" | "other";
type Method = "cash" | "upi" | "bank" | "other";

const KIND_LABEL: Record<string, string> = {
  stud_fee: "Stud fee",
  pick_of_litter: "Pick of litter",
  deposit: "Deposit",
  other: "Other",
  listing_boost: "Boost",
};

const STATUS_TONE: Record<string, string> = {
  pending: "bg-muted text-muted-foreground",
  marked_paid: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  confirmed: "bg-primary-soft text-primary",
  disputed: "bg-destructive/10 text-destructive",
  cancelled: "bg-muted text-muted-foreground line-through",
};

export const MatingPaymentsCard = ({
  requestId,
  otherUserId,
}: {
  requestId: string;
  otherUserId: string;
}) => {
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

  // New payment draft (current user is payer → otherUserId is payee)
  const [kind, setKind] = useState<PaymentKind>("stud_fee");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<Method>("upi");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("mating_payments")
        .select("*")
        .eq("request_id", requestId)
        .order("created_at", { ascending: false });
      if (!cancelled) {
        if (!error) setItems(data ?? []);
        setLoading(false);
      }
    })();
    const ch = supabase.channel(`payments:${requestId}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "mating_payments", filter: `request_id=eq.${requestId}` },
        async () => {
          const { data } = await supabase.from("mating_payments").select("*").eq("request_id", requestId).order("created_at", { ascending: false });
          setItems(data ?? []);
        })
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, [requestId]);

  const addPayment = async () => {
    if (!user) return;
    if (!amount || Number(amount) <= 0) return toast.error("Enter an amount");
    setSaving(true);
    const { error } = await supabase.from("mating_payments").insert({
      request_id: requestId,
      payer_id: user.id,
      payee_id: otherUserId,
      kind,
      amount_inr: Number(amount),
      method,
      reference: reference.trim() || null,
      notes: notes.trim() || null,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Payment recorded");
    setAmount(""); setReference(""); setNotes(""); setAdding(false);
  };

  const update = async (id: string, patch: any, msg: string) => {
    const { error } = await supabase.from("mating_payments").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(msg);
  };

  return (
    <Card className="rounded-2xl border-hairline bg-card shadow-none p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wallet className="h-4 w-4 text-primary" />
          <div className="font-display text-base">Payments</div>
        </div>
        <Button size="sm" variant="outline" className="rounded-full border-hairline gap-1" onClick={() => setAdding((v) => !v)}>
          <Plus className="h-3.5 w-3.5" /> Record
        </Button>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Track offline payments between you and the other party. Petos doesn't process money — both sides confirm receipt for proof.
      </p>

      {adding && (
        <Card className="rounded-xl border-hairline bg-muted/30 p-3 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Type</Label>
              <Select value={kind} onValueChange={(v: any) => setKind(v)}>
                <SelectTrigger className="h-10 rounded-lg"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="stud_fee">Stud fee</SelectItem>
                  <SelectItem value="pick_of_litter">Pick of litter</SelectItem>
                  <SelectItem value="deposit">Deposit</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Amount (₹)</Label>
              <Input type="number" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)}
                className="h-10 rounded-lg border-hairline" placeholder="e.g. 5000" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Method</Label>
              <Select value={method} onValueChange={(v: any) => setMethod(v)}>
                <SelectTrigger className="h-10 rounded-lg"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="upi">UPI</SelectItem>
                  <SelectItem value="bank">Bank transfer</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Reference</Label>
              <Input value={reference} onChange={(e) => setReference(e.target.value)}
                className="h-10 rounded-lg border-hairline" placeholder="Txn id (optional)" />
            </div>
          </div>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes (optional)" className="rounded-lg border-hairline min-h-[50px]" />
          <Button onClick={addPayment} disabled={saving} size="sm" className="w-full rounded-lg">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save payment"}
          </Button>
        </Card>
      )}

      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground mx-auto" />
      ) : items.length === 0 ? (
        <div className="text-xs text-muted-foreground text-center py-3">No payments recorded yet.</div>
      ) : (
        <div className="space-y-2">
          {items.map((p) => {
            const iAmPayer = p.payer_id === user?.id;
            const iAmPayee = p.payee_id === user?.id;
            return (
              <div key={p.id} className="flex items-start justify-between gap-2 rounded-xl border border-hairline p-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-display text-base">₹{p.amount_inr.toLocaleString("en-IN")}</span>
                    <Badge className={`text-[10px] capitalize ${STATUS_TONE[p.status] ?? ""}`}>{p.status.replace("_", " ")}</Badge>
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {KIND_LABEL[p.kind] ?? p.kind} · {p.method.toUpperCase()} · {iAmPayer ? "You paid" : "You received"} · {format(new Date(p.created_at), "d MMM, h:mm a")}
                  </div>
                  {p.reference && <div className="text-[11px] text-muted-foreground truncate">Ref: {p.reference}</div>}
                  {p.notes && <div className="text-xs mt-1 text-ink-soft">{p.notes}</div>}
                </div>
                <div className="flex flex-col gap-1 shrink-0">
                  {iAmPayer && p.status === "pending" && (
                    <Button size="sm" variant="outline" className="h-7 rounded-full text-[11px] border-hairline gap-1"
                      onClick={() => update(p.id, { status: "marked_paid", marked_paid_at: new Date().toISOString() }, "Marked as paid")}>
                      Marked paid
                    </Button>
                  )}
                  {iAmPayee && (p.status === "pending" || p.status === "marked_paid") && (
                    <Button size="sm" className="h-7 rounded-full text-[11px] gap-1"
                      onClick={() => update(p.id, { status: "confirmed", confirmed_at: new Date().toISOString() }, "Confirmed")}>
                      <Check className="h-3 w-3" /> Confirm
                    </Button>
                  )}
                  {iAmPayee && p.status === "marked_paid" && (
                    <Button size="sm" variant="outline" className="h-7 rounded-full text-[11px] border-hairline text-destructive"
                      onClick={() => update(p.id, { status: "disputed" }, "Marked as disputed")}>
                      <X className="h-3 w-3" /> Dispute
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
};