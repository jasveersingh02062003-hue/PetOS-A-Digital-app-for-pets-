import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useTier } from "@/hooks/useTier";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2 } from "lucide-react";

const PlusSuccess = () => {
  const nav = useNavigate();
  const qc = useQueryClient();
  const { data: tier, refetch } = useTier();
  const [tries, setTries] = useState(0);

  // Poll until webhook upserts subscription row.
  useEffect(() => {
    if (tier?.tier === "plus") return;
    if (tries > 12) return; // ~24s
    const t = setTimeout(() => {
      qc.invalidateQueries({ queryKey: ["tier"] });
      refetch();
      setTries((n) => n + 1);
    }, 2000);
    return () => clearTimeout(t);
  }, [tier, tries, qc, refetch]);

  const ready = tier?.tier === "plus";

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 text-center">
      <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-6">
        {ready ? <Sparkles className="h-7 w-7 text-primary" /> : <Loader2 className="h-7 w-7 text-primary animate-spin" />}
      </div>
      <h1 className="font-display text-3xl">{ready ? "Welcome to Plus 💚" : "Confirming your plan…"}</h1>
      <p className="text-sm text-muted-foreground mt-3 max-w-xs">
        {ready
          ? "All Plus features are unlocked. Your renewal date is in Settings → Billing."
          : "This usually takes a few seconds. Hang tight."}
      </p>
      <Button className="mt-8 rounded-2xl h-12 w-full max-w-xs" onClick={() => nav("/")}>
        {ready ? "Go to Home" : "Go to Home anyway"}
      </Button>
    </div>
  );
};

export default PlusSuccess;
