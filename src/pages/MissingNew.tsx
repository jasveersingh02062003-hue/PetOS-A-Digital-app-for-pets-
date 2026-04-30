import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { usePets } from "@/hooks/useProfile";
import { MissingCreateSheet } from "@/components/MissingCreateSheet";

const MissingNew = () => {
  const nav = useNavigate();
  const { data: pets } = usePets();
  const [activePet, setActivePet] = useState<any | null>(null);

  return (
    <div className="min-h-screen bg-background pad-bottom-safe">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-hairline">
        <div className="container-app h-14 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => nav(-1)}><ArrowLeft className="h-5 w-5" /></Button>
          <h1 className="font-display text-xl">Report missing</h1>
        </div>
      </header>

      <main className="container-app py-6 space-y-3">
        <p className="text-sm text-muted-foreground mb-3">Choose which pet is missing:</p>
        {pets?.map((p) => (
          <Card
            key={p.id}
            onClick={() => setActivePet(p)}
            className="rounded-2xl border-hairline shadow-none p-4 flex items-center gap-4 cursor-pointer hover:bg-muted/40 transition-colors"
          >
            <div className="h-12 w-12 rounded-full bg-muted overflow-hidden flex items-center justify-center font-display">
              {p.avatar_url ? <img src={p.avatar_url} alt={p.name} className="h-full w-full object-cover" loading="lazy" decoding="async" /> : p.name[0]}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium">{p.name}</div>
              <div className="text-xs text-muted-foreground">{p.breed ?? "—"} · {p.species}</div>
            </div>
          </Card>
        ))}
        {!pets?.length && (
          <Card className="rounded-2xl border-hairline shadow-none p-6 text-center text-sm text-muted-foreground">
            Add a pet first.
          </Card>
        )}
      </main>

      {activePet && (
        <MissingCreateSheet
          open={!!activePet}
          onOpenChange={(o) => !o && setActivePet(null)}
          pet={activePet}
        />
      )}
    </div>
  );
};

export default MissingNew;
