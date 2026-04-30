import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RatingStars } from "./RatingStars";
import { SubjectRating } from "./SubjectRating";
import { ReviewSheet } from "./ReviewSheet";
import { useAuth } from "@/hooks/useAuth";
import { BadgeCheck, Star } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";
import { format } from "date-fns";

type SubjectType = Database["public"]["Enums"]["review_subject"];

type Props = {
  subjectType: SubjectType;
  subjectId: string;
  subjectName: string;
};

export const ReviewList = ({ subjectType, subjectId, subjectName }: Props) => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  const { data: reviews } = useQuery({
    queryKey: ["reviews", subjectType, subjectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reviews")
        .select("*, profiles:reviewer_id(full_name, avatar_url)")
        .eq("subject_type", subjectType)
        .eq("subject_id", subjectId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  const myReview = reviews?.find((r) => r.reviewer_id === user?.id);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <SubjectRating type={subjectType} id={subjectId} size="md" />
        </div>
        <Button size="sm" variant="outline" className="rounded-full" onClick={() => setOpen(true)}>
          <Star className="h-3.5 w-3.5 mr-1" />
          {myReview ? "Edit review" : "Write review"}
        </Button>
      </div>

      {(reviews?.length ?? 0) === 0 && (
        <Card className="rounded-2xl border-hairline p-6 text-center text-sm text-muted-foreground">
          No reviews yet. Be the first.
        </Card>
      )}

      {reviews?.map((r: any) => (
        <Card key={r.id} className="rounded-2xl border-hairline p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-8 w-8 rounded-full bg-muted overflow-hidden">
              {r.profiles?.avatar_url && (
                <img src={r.profiles.avatar_url} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">
                {r.profiles?.full_name || "Anonymous"}
              </div>
              <div className="flex items-center gap-2">
                <RatingStars rating={r.rating} size="sm" />
                {r.verified_purchase && (
                  <span className="text-[10px] text-primary inline-flex items-center gap-0.5">
                    <BadgeCheck className="h-3 w-3" /> Verified
                  </span>
                )}
              </div>
            </div>
            <span className="text-xs text-muted-foreground">
              {format(new Date(r.created_at), "d MMM")}
            </span>
          </div>
          {r.body && <p className="text-sm leading-relaxed">{r.body}</p>}
        </Card>
      ))}

      <ReviewSheet
        open={open}
        onOpenChange={setOpen}
        subjectType={subjectType}
        subjectId={subjectId}
        subjectName={subjectName}
      />
    </div>
  );
};
