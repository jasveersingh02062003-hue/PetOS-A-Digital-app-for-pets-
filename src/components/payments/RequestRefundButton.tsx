import { useState } from "react";
import { Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

type SourceKind = "order" | "booking" | "taxi" | "appointment";

const REASONS = [
  { value: "not_received", label: "I didn't receive it" },
  { value: "damaged", label: "Item arrived damaged" },
  { value: "wrong_item", label: "Wrong item / not as described" },
  { value: "service_issue", label: "Service quality issue" },
  { value: "other", label: "Other" },
];

export function RequestRefundButton({
  sourceKind,
  sourceId,
  amountInr,
}: {
  sourceKind: SourceKind;
  sourceId: string;
  amountInr?: number;
}) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("not_received");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const submit = async () => {
    if (!user) return toast.error("Please sign in");
    setSubmitting(true);
    const reasonText = `${reason}${details.trim() ? `: ${details.trim()}` : ""}`;
    const { error } = await supabase.from("refund_requests").insert({
      user_id: user.id,
      source_kind: sourceKind,
      source_id: sourceId,
      amount_inr: amountInr ?? null,
      reason: reasonText,
    });
    setSubmitting(false);
    if (error) {
      if (error.code === "23505") {
        toast.info("You've already filed a request for this.");
        setSubmitted(true);
        setOpen(false);
        return;
      }
      return toast.error(error.message);
    }
    toast.success("Refund request submitted. Our team will review within 48 hours.");
    setSubmitted(true);
    setOpen(false);
  };

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="text-xs text-muted-foreground"
        onClick={() => setOpen(true)}
        disabled={submitted}
      >
        <AlertCircle className="h-3.5 w-3.5 mr-1" />
        {submitted ? "Request sent" : "Report a problem"}
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl">
          <SheetHeader>
            <SheetTitle>Request a refund</SheetTitle>
            <SheetDescription>
              Tell us what went wrong. Our team will get back to you within 48 hours.
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-4 mt-4 pb-6">
            <RadioGroup value={reason} onValueChange={setReason} className="space-y-2">
              {REASONS.map((r) => (
                <div
                  key={r.value}
                  className="flex items-center space-x-2 rounded-xl border border-hairline p-3 has-[:checked]:bg-primary-soft has-[:checked]:border-primary/30"
                >
                  <RadioGroupItem value={r.value} id={`rr-${r.value}`} />
                  <Label htmlFor={`rr-${r.value}`} className="text-sm flex-1 cursor-pointer">{r.label}</Label>
                </div>
              ))}
            </RadioGroup>
            <Textarea
              rows={3}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Add any details (optional)…"
            />
            <Button onClick={submit} disabled={submitting} className="w-full rounded-xl h-11">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit request"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}