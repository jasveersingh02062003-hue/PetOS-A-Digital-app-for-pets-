import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useVetQuestions, type VetCategory } from "@/hooks/useAskVet";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, MessageCircleQuestion, Stethoscope, Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { EmptyState } from "@/components/EmptyState";

const CATEGORIES: { value: VetCategory | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "behavior", label: "Behavior" },
  { value: "nutrition", label: "Nutrition" },
  { value: "medical", label: "Medical" },
  { value: "training", label: "Training" },
];

const AskVet = () => {
  const nav = useNavigate();
  const [cat, setCat] = useState<VetCategory | "all">("all");
  const { data: questions } = useVetQuestions(cat);

  return (
    <div className="container-app pad-top-safe pb-16">
      <header className="pt-4 pb-3 flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => nav(-1)}><ArrowLeft className="h-5 w-5" /></Button>
        <div className="flex-1">
          <h1 className="font-display text-2xl flex items-center gap-2">
            <Stethoscope className="h-6 w-6 text-primary" /> AskVet
          </h1>
          <p className="text-xs text-muted-foreground">Verified vets answer your questions</p>
        </div>
        <Button size="sm" className="rounded-full" onClick={() => nav("/askvet/new")}>
          <Plus className="h-4 w-4 mr-1.5" /> Ask
        </Button>
      </header>

      <Tabs value={cat} onValueChange={(v) => setCat(v as any)} className="mb-4">
        <TabsList className="w-full overflow-x-auto no-scrollbar flex justify-start rounded-xl">
          {CATEGORIES.map((c) => (
            <TabsTrigger key={c.value} value={c.value} className="shrink-0">{c.label}</TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="space-y-3">
        {(questions ?? []).map((q: any) => (
          <Link key={q.id} to={`/askvet/${q.id}`} className="block rounded-2xl border border-border bg-card p-4 hover:border-primary/40 transition-colors">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{q.category}</span>
              {q.status === "answered" && (
                <span className="text-[10px] uppercase tracking-wider text-primary flex items-center gap-1">
                  <Stethoscope className="h-3 w-3" /> Answered
                </span>
              )}
            </div>
            <h3 className="font-display text-base">{q.title}</h3>
            <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{q.body}</p>
            <div className="text-[11px] text-muted-foreground mt-2">{q.answer_count} answer{q.answer_count === 1 ? "" : "s"}</div>
          </Link>
        ))}
        {(!questions || questions.length === 0) && (
          <EmptyState
            icon={MessageCircleQuestion}
            title="No questions yet"
            description="Be the first to ask a verified vet."
            ctaLabel="Ask a question"
            onCta={() => nav("/askvet/new")}
          />
        )}
      </div>
    </div>
  );
};

export default AskVet;
