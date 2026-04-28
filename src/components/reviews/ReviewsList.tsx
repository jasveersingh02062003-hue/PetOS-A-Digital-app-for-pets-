import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Star, ShieldCheck } from "lucide-react";

type SubjectType = "provider" | "pet_partner" | "vet" | "product";

export function useReviewSummary(subjectType: SubjectType, subjectId?: string) {
  return useQuery({
    queryKey: ["reviews-summary", subjectType, subjectId],
    enabled: !!subjectId,
    queryFn: async () => {
      const { data } = await supabase
        .from("reviews")
        .select("rating")
        .eq("subject_type", subjectType)
        .eq("subject_id", subjectId!);
      const arr = data ?? [];
      const count = arr.length;
      const avg = count ? arr.reduce((s, r: any) => s + (r.rating ?? 0), 0) / count : 0;
      return { count, avg };
    },
  });
}

export function ReviewsList({ subjectType, subjectId }: { subjectType: SubjectType; subjectId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["reviews", subjectType, subjectId],
    queryFn: async () => {
      const { data } = await supabase
        .from("reviews")
        .select("id, rating, body, verified_purchase, created_at, reviewer_id")
        .eq("subject_type", subjectType)
        .eq("subject_id", subjectId)
        .order("created_at", { ascending: false })
        .limit(50);
      const reviews = data ?? [];
      const reviewerIds = Array.from(new Set(reviews.map((r: any) => r.reviewer_id)));
      let profiles: Record<string, any> = {};
      if (reviewerIds.length) {
        const { data: ps } = await supabase.rpc("get_profiles_public" as any);
        if (Array.isArray(ps)) {
          for (const p of ps as any[]) {
            if (reviewerIds.includes(p.id)) profiles[p.id] = p;
          }
        }
      }
      return reviews.map((r: any) => ({ ...r, reviewer: profiles[r.reviewer_id] }));
    },
  });

  if (isLoading) return <div className="text-center text-sm text-muted-foreground py-6">Loading…</div>;
  if (!data?.length) return <div className="text-center text-sm text-muted-foreground py-6">No reviews yet.</div>;

  return (
    <div className="space-y-2">
      {data.map((r: any) => (
        <Card key={r.id} className="rounded-2xl border-hairline p-3">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-full bg-muted overflow-hidden flex items-center justify-center text-xs font-display">
                {r.reviewer?.avatar_url ? (
                  <img src={r.reviewer.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  (r.reviewer?.full_name ?? "?")[0]
                )}
              </div>
              <div className="text-sm font-medium truncate">{r.reviewer?.full_name ?? "User"}</div>
              {r.verified_purchase && (
                <Badge variant="outline" className="gap-1 border-leaf/40 text-leaf text-[10px] px-1.5 py-0">
                  <ShieldCheck className="h-3 w-3" /> Verified
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-0.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className={`h-3.5 w-3.5 ${i < r.rating ? "fill-coral text-coral" : "text-muted-foreground/40"}`} />
              ))}
            </div>
          </div>
          {r.body && <p className="text-sm text-muted-foreground whitespace-pre-wrap">{r.body}</p>}
        </Card>
      ))}
    </div>
  );
}

export function RatingChip({ subjectType, subjectId }: { subjectType: SubjectType; subjectId?: string }) {
  const { data } = useReviewSummary(subjectType, subjectId);
  if (!data || !data.count) return null;
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <Star className="h-3 w-3 fill-coral text-coral" />
      <span className="tabular-nums">{data.avg.toFixed(1)}</span>
      <span>({data.count})</span>
    </span>
  );
}