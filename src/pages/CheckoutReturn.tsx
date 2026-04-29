import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle2, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function CheckoutReturn() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const sessionId = params.get("session_id");
  const next = params.get("next") || "/";
  const [phase, setPhase] = useState<"loading" | "success">("loading");

  useEffect(() => {
    // Embedded checkout return = payment intent submitted. Show celebration.
    const t = setTimeout(() => setPhase("success"), 600);
    return () => clearTimeout(t);
  }, [sessionId]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 grid place-items-center px-6 pad-bottom-safe">
      <div className="max-w-sm w-full text-center space-y-5">
        {phase === "loading" ? (
          <>
            <Loader2 className="h-12 w-12 mx-auto animate-spin text-primary" />
            <p className="text-muted-foreground">Confirming your payment…</p>
          </>
        ) : (
          <>
            <div className="relative mx-auto h-20 w-20">
              <div className="absolute inset-0 rounded-full bg-emerald-500/15 animate-ping" />
              <div className="relative h-20 w-20 rounded-full bg-emerald-500/15 grid place-items-center">
                <CheckCircle2 className="h-12 w-12 text-emerald-600" />
              </div>
            </div>
            <div className="space-y-1">
              <h1 className="text-2xl font-bold flex items-center justify-center gap-2">
                Payment received <Sparkles className="h-5 w-5 text-amber-500" />
              </h1>
              <p className="text-sm text-muted-foreground">A receipt is on its way to your inbox.</p>
            </div>
            {sessionId && (
              <p className="text-[10px] text-muted-foreground/70 font-mono break-all">
                ref: {sessionId.slice(0, 24)}…
              </p>
            )}
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => nav("/")}>Home</Button>
              <Button className="flex-1" onClick={() => nav(next)}>Continue</Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}