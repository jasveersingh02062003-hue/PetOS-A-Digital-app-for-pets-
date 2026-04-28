import { useState } from "react";
import { Flag, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type SubjectType = "post" | "comment" | "product" | "provider" | "user" | "listing";

const REASONS = [
  "Spam or scam",
  "Inappropriate content",
  "Harassment or hate",
  "Animal welfare concern",
  "Misinformation",
  "Other",
];

export const ReportButton = ({
  subjectType,
  subjectId,
  variant = "ghost",
  size = "sm",
  label,
}: {
  subjectType: SubjectType;
  subjectId: string;
  variant?: "ghost" | "outline" | "default";
  size?: "sm" | "icon" | "default";
  label?: string;
}) => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState(REASONS[0]);
  const [details, setDetails] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!user) {
      toast.error("Sign in to report");
      return;
    }
    setLoading(true);
    const { error } = await supabase.from("reports").insert({
      reporter_id: user.id,
      subject_type: subjectType,
      subject_id: subjectId,
      reason,
      details: details.trim() || null,
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Report submitted — thank you");
    setOpen(false);
    setDetails("");
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant={variant} size={size} className="gap-1.5 text-muted-foreground">
          <Flag className="h-3.5 w-3.5" />
          {label && <span className="text-xs">{label}</span>}
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="rounded-t-2xl">
        <SheetHeader>
          <SheetTitle>Report</SheetTitle>
        </SheetHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Reason</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {REASONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Details (optional)</Label>
            <Textarea value={details} onChange={(e) => setDetails(e.target.value)} rows={4} />
          </div>
          <Button onClick={submit} disabled={loading} className="w-full rounded-xl h-11">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit report"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};
