import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Stethoscope, X, ChevronRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

type Suggestion = {
  id: string;
  kind: string;
  reason: string;
  deep_link: string | null;
  status: string;
  created_at: string;
};

/**
 * Owner-side inbox of system-generated "next action" prompts
 * (currently: vet follow-up after a walker health flag).
 */
export function BookingSuggestionsCard() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ["booking-suggestions", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<Suggestion[]> => {
      const { data, error } = await supabase
        .from("booking_suggestions" as any)
        .select("id, kind, reason, deep_link, status, created_at")
        .eq("owner_id", user!.id)
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .limit(3);
      if (error) return [];
      return (data ?? []) as unknown as Suggestion[];
    },
  });

  if (!data || data.length === 0) return null;

  const dismiss = async (id: string) => {
    await supabase
      .from("booking_suggestions" as any)
      .update({ status: "dismissed" })
      .eq("id", id);
    qc.invalidateQueries({ queryKey: ["booking-suggestions", user?.id] });
  };

  return (
    <div className="space-y-2 my-3">
      {data.map((s) => (
        <Card
          key={s.id}
          className="rounded-2xl border-hairline p-3 flex items-start gap-3"
        >
          <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <Stethoscope className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium">Vet follow-up suggested</div>
            <div className="text-xs text-muted-foreground line-clamp-2">{s.reason}</div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground/80 mt-1">
              {formatDistanceToNow(new Date(s.created_at), { addSuffix: true })}
            </div>
            <div className="mt-2 flex gap-2">
              <Button asChild size="sm" className="rounded-full h-8">
                <Link to={s.deep_link || "/services/vet"}>
                  Book vet <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
                </Link>
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="rounded-full h-8"
                onClick={() => dismiss(s.id)}
                aria-label="Dismiss"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}