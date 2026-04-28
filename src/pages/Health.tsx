import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePets } from "@/hooks/useProfile";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Heart, MessageSquare, ShieldCheck, Syringe, Utensils, Activity, FileText, ChevronRight } from "lucide-react";

const Health = () => {
  const { data: pets } = usePets();
  const [activeIdx, setActiveIdx] = useState(0);
  const active = pets?.[activeIdx];
  const nav = useNavigate();

  return (
    <div className="container-app pad-top-safe">
      <header className="pt-6 pb-4 flex items-center justify-between">
        <h1 className="font-display text-3xl">Health vault</h1>
        <Heart className="h-5 w-5 text-primary" strokeWidth={1.5} />
      </header>

      {/* Pet selector */}
      {pets && pets.length > 0 && (
        <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-5 px-5 mb-6">
          {pets.map((p, i) => (
            <button
              key={p.id}
              onClick={() => setActiveIdx(i)}
              className={`shrink-0 px-4 py-2 rounded-full text-sm border transition-colors ${i === activeIdx ? "bg-primary text-primary-foreground border-primary" : "bg-card border-hairline text-foreground"}`}
            >
              {p.name}
            </button>
          ))}
        </div>
      )}

      {!active ? (
        <Card className="rounded-2xl border-hairline bg-card shadow-none p-8 text-center">
          <div className="font-display text-lg">Add a pet to begin</div>
          <p className="text-sm text-muted-foreground mt-1">Vault, AI, and consults appear here.</p>
        </Card>
      ) : (
        <>
          <Card className="rounded-2xl border-hairline bg-card shadow-none p-5 mb-4">
            <div className="flex items-center gap-3 mb-1">
              <div className="font-display text-2xl">{active.name}</div>
              {active.vaccination_verified && (
                <div className="inline-flex items-center gap-1 text-xs text-primary bg-primary-soft px-2 py-0.5 rounded-full">
                  <ShieldCheck className="h-3 w-3" /> Verified
                </div>
              )}
            </div>
            <div className="text-sm text-muted-foreground">{active.breed} · {active.species}</div>
          </Card>

          <Button onClick={() => nav("/ai")} size="lg" className="w-full rounded-2xl h-14 mb-6 justify-start gap-3">
            <MessageSquare className="h-5 w-5" strokeWidth={1.75} />
            <div className="text-left">
              <div className="font-medium">Ask the AI assistant</div>
              <div className="text-xs opacity-80">Personal to {active.name}</div>
            </div>
          </Button>

          <div className="grid grid-cols-2 gap-3">
            <Tile icon={Syringe} label="Vaccinations" />
            <Tile icon={Utensils} label="Nutrition" />
            <Tile icon={Activity} label="Symptoms" />
            <Tile icon={FileText} label="Records" />
          </div>

          <h2 className="font-display text-xl mt-8 mb-3">Recent consults</h2>
          <Card className="rounded-2xl border-hairline bg-card shadow-none p-5 text-center text-sm text-muted-foreground">
            No consults yet
          </Card>
        </>
      )}
    </div>
  );
};

const Tile = ({ icon: Icon, label }: { icon: any; label: string }) => (
  <Card className="rounded-2xl border-hairline bg-card shadow-none p-4 flex items-center justify-between cursor-pointer hover:bg-muted/40 transition-colors">
    <div className="flex items-center gap-3">
      <Icon className="h-5 w-5 text-primary" strokeWidth={1.5} />
      <span className="text-sm font-medium">{label}</span>
    </div>
    <ChevronRight className="h-4 w-4 text-muted-foreground" />
  </Card>
);

export default Health;
