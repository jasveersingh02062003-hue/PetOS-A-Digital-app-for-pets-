import { useState } from "react";
import { Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { getStripeEnvironment } from "@/lib/stripe";
import { toast } from "sonner";

interface Props {
  intentId: string;
  amountInr: number;
  onRefunded?: () => void;
}

const REASONS = [
  { value: "requested_by_customer", label: "Customer requested" },
  { value: "duplicate", label: "Duplicate charge" },
  { value: "service_not_provided", label: "Service not provided" },
  { value: "other", label: "Other" },
];

export function RefundButton({ intentId, amountInr, onRefunded }: Props) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("requested_by_customer");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    setSubmitting(true);
    const { data, error } = await supabase.functions.invoke("payments-refund", {
      body: { intentId, reason, environment: getStripeEnvironment() },
    });
    setSubmitting(false);
    if (error || !data?.ok) {
      toast.error(data?.error ?? error?.message ?? "Refund failed");
      return;
    }
    toast.success("Refund issued. Funds return in 5–10 days.");
    setOpen(false);
    onRefunded?.();
  };

  const formatted = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amountInr);

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <RotateCcw className="h-4 w-4 mr-1.5" /> Refund
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Refund {formatted}?</DialogTitle>
            <DialogDescription>The customer will receive funds in 5–10 business days. Pick a reason.</DialogDescription>
          </DialogHeader>
          <RadioGroup value={reason} onValueChange={setReason} className="space-y-2 py-2">
            {REASONS.map((r) => (
              <div key={r.value} className="flex items-center space-x-2 rounded-lg border border-hairline p-3 has-[:checked]:bg-primary/5 has-[:checked]:border-primary/30">
                <RadioGroupItem value={r.value} id={`reason-${r.value}`} />
                <Label htmlFor={`reason-${r.value}`} className="text-sm font-medium cursor-pointer flex-1">{r.label}</Label>
              </div>
            ))}
          </RadioGroup>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}>Cancel</Button>
            <Button onClick={submit} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
              Refund {formatted}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}