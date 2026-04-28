import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Star, ShieldCheck } from "lucide-react";

type SubjectType = "provider" | "product" | "vet" | "pet_partner";

type Summary = {
  count: number;
  avg: number;
  verified_count: number;
  distribution?: Record<string, number>;
};

export function RatingSummary({
  subjectType,
  subjectId,
  size = "sm",
  showCount = true,
}: {
  subjectType: SubjectType;
  subjectId: string;
  size?: "sm" | "md" | "lg";
  showCount?: boolean;
}) {
  const [s, setS] = useState<Summary | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase.rpc("review_summary" as any, {
        _subject_type: subjectType,
        _subject_id: subjectId,
      });
      if (active) setS((data as any) ?? null);
    })();
    return () => { active = false; };
  }, [subjectType, subjectId]);

  if (!s || s.count === 0) {
    return showCount ? <span className="text-xs text-muted-foreground">No reviews yet</span> : null;
  }

  const starSize = size === "lg" ? "h-5 w-5" : size === "md" ? "h-4 w-4" : "h-3.5 w-3.5";
  const textSize = size === "lg" ? "text-base" : size === "md" ? "text-sm" : "text-xs";

  return (
    <div className={`inline-flex items-center gap-1.5 ${textSize}`}>
      <Star className={`${starSize} fill-amber-400 text-amber-400`} />
      <span className="font-semibold">{Number(s.avg).toFixed(1)}</span>
      {showCount && <span className="text-muted-foreground">({s.count})</span>}
      {s.verified_count > 0 && (
        <span className="inline-flex items-center gap-0.5 text-[10px] text-emerald-600 font-medium">
          <ShieldCheck className="h-3 w-3" />
          {s.verified_count} verified
        </span>
      )}
    </div>
  );
}