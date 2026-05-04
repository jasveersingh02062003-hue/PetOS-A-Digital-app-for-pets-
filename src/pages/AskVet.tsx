import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useVetQuestions, useMyVetQuestions, type VetCategory } from "@/hooks/useAskVet";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, MessageCircleQuestion, Stethoscope, Plus, Inbox } from "lucide-react";
import { Link } from "react-router-dom";
import { EmptyState } from "@/components/EmptyState";
import { useAuth } from "@/hooks/useAuth";
import { useSeo } from "@/hooks/useSeo";

const CATEGORIES: { value: VetCategory | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "behavior", label: "Behavior" },
  { value: "nutrition", label: "Nutrition" },
  { value: "medical", label: "Medical" },
  { value: "training", label: "Training" },
];

const AskVet = () => {
  useSeo({ title: "Ask a Vet", description: "Verified vets answer your pet health questions." });
  const nav = useNavigate();
  const { user } = useAuth();
  const [cat, setCat] = useState<VetCategory | "all">("all");
  const [scope, setScope] = useState<"feed" | "mine">("feed");
  const { data: questions } = useVetQuestions(cat);
  const { data: mine } = useMyVetQuestions();
  const list = scope === "mine" ? (mine ?? []) : (questions ?? []);

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

      {user && (
        <div className="flex gap-2 mb-3">
          <button
            onClick={() => setScope("feed")}
            className={`h-8 px-3 rounded-full text-xs font-medium border transition ${
              scope === "feed"
                ? "bg-foreground text-background border-foreground"
                : "bg-card text-muted-foreground border-hairline"
            }`}
          >
            All questions
          </button>
          <button
            onClick={() => setScope("mine")}
            className={`h-8 px-3 rounded-full text-xs font-medium border transition flex items-center gap-1.5 ${
              scope === "mine"
                ? "bg-foreground text-background border-foreground"
                : "bg-card text-muted-foreground border-hairline"
            }`}
          >
            <Inbox className="h-3.5 w-3.5" /> My questions
            {mine && mine.length > 0 && (
              <span className="ml-0.5 text-[10px]">({mine.length})</span>
            )}
          </button>
        </div>
      )}

      {scope === "feed" && (
      <Tabs value={cat} onValueChange={(v) => setCat(v as any)} className="mb-4">
        <TabsList className="w-full overflow-x-auto no-scrollbar flex justify-start rounded-xl">
          {CATEGORIES.map((c) => (
            <TabsTrigger key={c.value} value={c.value} className="shrink-0">{c.label}</TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      )}

      <div className="space-y-3">
        {list.map((q: any) => (
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
        {list.length === 0 && (
          <EmptyState
            icon={MessageCircleQuestion}
            title={scope === "mine" ? "You haven't asked yet" : "No questions yet"}
            description={scope === "mine" ? "Ask a vet about your pet — they'll reply soon." : "Be the first to ask a verified vet."}
            ctaLabel="Ask a question"
            onCta={() => nav("/askvet/new")}
          />
        )}
      </div>
    </div>
  );
};

export default AskVet;
