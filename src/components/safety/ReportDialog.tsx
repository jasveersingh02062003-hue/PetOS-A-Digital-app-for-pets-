import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Flag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type ReportSubject = "post" | "comment" | "product" | "provider" | "user" | "listing";

const REASONS = [
  { value: "spam", label: "Spam or scam" },
  { value: "harassment", label: "Harassment or hate" },
  { value: "sexual", label: "Sexual or explicit" },
  { value: "animal_cruelty", label: "Animal cruelty" },
  { value: "misinformation", label: "False or misleading" },
  { value: "other", label: "Something else" },
];

interface Props {
  subjectType: ReportSubject;
  subjectId: string;
  trigger?: React.ReactNode;
}

export function ReportDialog({ subjectType, subjectId, trigger }: Props) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("spam");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    setSubmitting(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Sign in to report");
      setSubmitting(false);
      return;
    }
    const { error } = await supabase.from("reports").insert({
      reporter_id: user.id,
      subject_type: subjectType,
      subject_id: subjectId,
      reason,
      details: details.trim() || null,
    });
    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success("Thanks — our team will review this");
    setOpen(false);
    setDetails("");
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <span onClick={(e) => { e.stopPropagation(); setOpen(true); }}>
        {trigger ?? (
          <button className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <Flag className="w-3.5 h-3.5" /> Report
          </button>
        )}
      </span>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Report {subjectType}</DialogTitle></DialogHeader>
        <RadioGroup value={reason} onValueChange={setReason} className="space-y-2 mt-2">
          {REASONS.map((r) => (
            <div key={r.value} className="flex items-center gap-2">
              <RadioGroupItem id={`r-${r.value}`} value={r.value} />
              <Label htmlFor={`r-${r.value}`} className="text-sm">{r.label}</Label>
            </div>
          ))}
        </RadioGroup>
        <Textarea
          placeholder="Optional details (what happened?)"
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          maxLength={500}
          rows={3}
          className="mt-3"
        />
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={submitting}>Cancel</Button>
          <Button onClick={submit} disabled={submitting}>{submitting ? "Sending…" : "Submit report"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
