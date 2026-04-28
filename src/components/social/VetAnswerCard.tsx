import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useIsHelpful, useToggleHelpful } from "@/hooks/useAskVet";
import { Stethoscope, ThumbsUp, Calendar } from "lucide-react";

export const VetAnswerCard = ({ answer }: { answer: any }) => {
  const { data: vet } = useQuery({
    queryKey: ["vet-profile", answer.vet_id],
    queryFn: async () => {
      const { data } = await supabase.rpc("get_profiles_public");
      return (data ?? []).find((p: any) => p.id === answer.vet_id) ?? null;
    },
  });
  const { data: isHelpful } = useIsHelpful(answer.id);
  const toggle = useToggleHelpful();

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 mb-2">
        <div className="h-8 w-8 rounded-full bg-primary-soft flex items-center justify-center">
          {vet?.avatar_url ? (
            <img src={vet.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
          ) : (
            <Stethoscope className="h-4 w-4 text-primary" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <Link to={`/u/${answer.vet_id}`} className="text-sm font-medium truncate block">
            Dr. {vet?.full_name?.split(" ")[0] ?? "Vet"}
          </Link>
          <span className="text-[10px] uppercase tracking-wider text-primary flex items-center gap-1">
            <Stethoscope className="h-3 w-3" /> Verified vet
          </span>
        </div>
      </div>

      <p className="text-sm whitespace-pre-wrap">{answer.body}</p>

      <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
        <Button
          size="sm"
          variant={isHelpful ? "default" : "outline"}
          className="rounded-full h-8"
          disabled={toggle.isPending}
          onClick={() => toggle.mutate({ answerId: answer.id, isHelpful: !!isHelpful, questionId: answer.question_id })}
        >
          <ThumbsUp className="h-3.5 w-3.5 mr-1.5" />
          Helpful · {answer.helpful_count}
        </Button>
        <Link to={`/book-vet?vetId=${answer.vet_id}`}>
          <Button size="sm" variant="ghost" className="rounded-full h-8">
            <Calendar className="h-3.5 w-3.5 mr-1.5" />
            Book consult
          </Button>
        </Link>
      </div>
    </div>
  );
};
