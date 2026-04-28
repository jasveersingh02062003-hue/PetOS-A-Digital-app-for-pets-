import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RatingStars } from "./RatingStars";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type SubjectType = Database["public"]["Enums"]["review_subject"];

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  subjectType: SubjectType;
  subjectId: string;
  subjectName: string;
};

export const ReviewSheet = ({ open, onOpenChange, subjectType, subjectId, subjectName }: Props) => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [rating, setRating] = useState(5);
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!user) return toast.error("Sign in first");
    setSaving(true);
    const { error } = await supabase.from("reviews").upsert(
      {
        reviewer_id: user.id,
        subject_type: subjectType,
        subject_id: subjectId,
        rating,
        body: body || null,
      },
      { onConflict: "reviewer_id,subject_type,subject_id" },
    );
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Review posted");
    qc.invalidateQueries({ queryKey: ["rating", subjectType, subjectId] });
    qc.invalidateQueries({ queryKey: ["reviews", subjectType, subjectId] });
    onOpenChange(false);
    setBody("");
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl">
        <SheetHeader>
          <SheetTitle className="font-display">Review {subjectName}</SheetTitle>
        </SheetHeader>
        <div className="space-y-4 pt-4">
          <div className="flex flex-col items-center gap-2 py-2">
            <RatingStars rating={rating} size="lg" interactive onChange={setRating} />
            <span className="text-xs text-muted-foreground">Tap to rate</span>
          </div>
          <div className="space-y-1.5">
            <Label>Your review (optional)</Label>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              placeholder="Share your experience"
            />
          </div>
          <Button onClick={submit} disabled={saving} className="w-full rounded-full h-12">
            {saving ? "Posting…" : "Post review"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};
