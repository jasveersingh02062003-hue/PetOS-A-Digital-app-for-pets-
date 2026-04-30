import { useState } from "react";
import { Flag, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { z } from "zod";
import { track } from "@/lib/analytics";

type SubjectType = "listing" | "provider" | "user" | "product" | "mate_listing" | "org";

const REASONS = [
  "Looks like a scam",
  "Suspicious price / fake photos",
  "Animal welfare concern",
  "Wrong category / spam",
  "Other",
];

const detailsSchema = z.string().trim().max(1000, "Keep it under 1000 characters");
const SESSION_KEY = "petos.session_id";

function getSessionId(): string {
  try {
    const ex = sessionStorage.getItem(SESSION_KEY);
    if (ex) return ex;
    const id = crypto.randomUUID();
    sessionStorage.setItem(SESSION_KEY, id);
    return id;
  } catch { return crypto.randomUUID(); }
}

/**
 * Anonymous report button — works for logged-out visitors on public pages.
 * Server-side trigger rate-limits to 5 reports / session / hour.
 */
export const AnonReportButton = ({
  subjectType,
  subjectId,
  className,
}: {
  subjectType: SubjectType;
  subjectId: string;
  className?: string;
}) => {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState(REASONS[0]);
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const parsed = detailsSchema.safeParse(details);
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    setBusy(true);
    const { error } = await supabase.from("anon_reports" as any).insert({
      subject_type: subjectType,
      subject_id: subjectId,
      reason,
      details: parsed.data || null,
      reporter_session: getSessionId(),
      user_agent: navigator.userAgent.slice(0, 300),
    } as any);
    setBusy(false);
    if (error) {
      if (/rate_limited/i.test(error.message)) {
        toast.error("Too many reports from this session. Try again later.");
      } else {
        toast.error(error.message);
      }
      return;
    }
    track("anon_report_submitted", { subjectType });
    toast.success("Thanks — our team will review this.");
    setOpen(false);
    setDetails("");
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="sm" className={`gap-1.5 text-muted-foreground ${className ?? ""}`}>
          <Flag className="h-3.5 w-3.5" />
          <span className="text-xs">Report</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="rounded-t-2xl">
        <SheetHeader className="text-left">
          <SheetTitle>Report this listing</SheetTitle>
          <SheetDescription>
            No account needed. Reports are anonymous and reviewed by our trust team.
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Reason</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {REASONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Details (optional)</Label>
            <Textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              maxLength={1000}
              rows={4}
              placeholder="What looked off? Links, prices, anything that helps."
            />
          </div>
          <Button onClick={submit} disabled={busy} className="w-full rounded-xl h-11">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit report"}
          </Button>
          <p className="text-[11px] text-muted-foreground text-center">
            Abuse is rate-limited. Repeat false reports may be blocked.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
};