import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useIsHelpful, useToggleHelpful } from "@/hooks/useAskVet";
import { ThumbsUp, Calendar } from "lucide-react";
import { AuthorIdentity } from "@/components/AuthorIdentity";

export const VetAnswerCard = ({ answer }: { answer: any }) => {
  const { data: isHelpful } = useIsHelpful(answer.id);
  const toggle = useToggleHelpful();

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <AuthorIdentity userId={answer.vet_id} size="sm" className="mb-2" />

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
