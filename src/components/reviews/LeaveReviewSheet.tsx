import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Star, Loader2 } from "lucide-react";
import { toast } from "sonner";

type SubjectType = "provider" | "pet_partner" | "vet" | "product";

/**
 * Generic review sheet. Rating 1-5 + optional body.
 * `subjectType='provider'` is used for breeder/shelter/kennel sellers (subject_id = their user_id).
 */
export function LeaveReviewSheet({
  open,
  onOpenChange,
  subjectType,
  subjectId,
  subjectName,
  context,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  subjectType: SubjectType;
  subjectId: string;
  subjectName?: string;
  context?: string;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [rating, setRating] = useState(5);
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("reviews").upsert(
        {
          reviewer_id: user.id,
          subject_type: subjectType,
          subject_id: subjectId,
          rating,
          body: body.trim() || null,
        },
        { onConflict: "reviewer_id,subject_type,subject_id" }
      );
      if (error) throw error;
      toast.success("Thanks for your review!");
      qc.invalidateQueries({ queryKey: ["reviews", subjectType, subjectId] });
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to submit review");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl">
        <SheetHeader>
          <SheetTitle>Rate {subjectName ?? "this seller"}</SheetTitle>
          {context && <SheetDescription>{context}</SheetDescription>}
        </SheetHeader>
        <div className="space-y-4 mt-4 pb-6">
          <div className="flex items-center justify-center gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} onClick={() => setRating(n)} aria-label={`${n} stars`}>
                <Star className={`h-9 w-9 ${n <= rating ? "fill-coral text-coral" : "text-muted-foreground"}`} />
              </button>
            ))}
          </div>
          <Textarea rows={4} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Share details about your experience (optional)…" />
          <Button onClick={submit} disabled={saving} className="w-full rounded-xl h-11">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit review"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}