import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useVetQuestion, useVetAnswers, useCreateVetAnswer, useIsVet } from "@/hooks/useAskVet";
import { VetAnswerCard } from "@/components/social/VetAnswerCard";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Stethoscope } from "lucide-react";

const AskVetDetail = () => {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const { data: q, isLoading } = useVetQuestion(id);
  const { data: answers } = useVetAnswers(id);
  const { data: isVet } = useIsVet();
  const create = useCreateVetAnswer();
  const [body, setBody] = useState("");

  if (isLoading) return <div className="container-app pad-top-safe pt-10 text-muted-foreground">Loading…</div>;
  if (!q) return <div className="container-app pad-top-safe pt-10 text-muted-foreground">Question not found.</div>;

  const submit = async () => {
    if (!body.trim() || !id) return;
    await create.mutateAsync({ questionId: id, body: body.trim() });
    setBody("");
  };

  return (
    <div className="container-app pad-top-safe pb-16">
      <header className="pt-4 pb-3 flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => nav(-1)}><ArrowLeft className="h-5 w-5" /></Button>
      </header>

      <div className="rounded-2xl border border-border bg-card p-5 mb-4">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{q.category}</span>
        <h1 className="font-display text-xl mt-1">{q.title}</h1>
        <p className="text-sm whitespace-pre-wrap mt-2">{q.body}</p>
      </div>

      <h2 className="font-display text-lg mb-3 flex items-center gap-2">
        <Stethoscope className="h-4 w-4 text-primary" /> {q.answer_count} answer{q.answer_count === 1 ? "" : "s"}
      </h2>

      <div className="space-y-3 mb-6">
        {(answers ?? []).map((a: any) => <VetAnswerCard key={a.id} answer={a} />)}
        {(!answers || answers.length === 0) && (
          <p className="text-sm text-muted-foreground text-center py-6">No answers yet — a verified vet will respond soon.</p>
        )}
      </div>

      {isVet && (
        <div className="rounded-2xl border border-primary/30 bg-primary-soft/30 p-4">
          <div className="text-xs uppercase tracking-wider text-primary mb-2 flex items-center gap-1">
            <Stethoscope className="h-3 w-3" /> Answer as vet
          </div>
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} placeholder="Share your professional perspective…" />
          <Button onClick={submit} disabled={create.isPending || !body.trim()} className="w-full mt-3 rounded-full">
            {create.isPending ? "Posting…" : "Post answer"}
          </Button>
        </div>
      )}
    </div>
  );
};

export default AskVetDetail;
