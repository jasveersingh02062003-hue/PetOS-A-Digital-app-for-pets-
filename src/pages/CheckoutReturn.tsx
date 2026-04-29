import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle2, Loader2, Sparkles, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { getStripeEnvironment } from "@/lib/stripe";

export default function CheckoutReturn() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const sessionId = params.get("session_id");
  const next = params.get("next") || "/";
  const [phase, setPhase] = useState<"loading" | "success" | "failed">("loading");
  const [intentId, setIntentId] = useState<string | null>(null);
  const [receiptNumber, setReceiptNumber] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!sessionId) { setPhase("success"); return; }
      try {
        const { data, error } = await supabase.functions.invoke("payments-mark-paid", {
          body: { sessionId, environment: getStripeEnvironment() },
        });
        if (cancelled) return;
        if (error || !data?.ok) { setPhase("success"); return; }
        setIntentId(data.intentId ?? null);
        setReceiptNumber(data.receiptNumber ?? null);
        setPhase(data.paid ? "success" : "failed");
      } catch {
        if (!cancelled) setPhase("success");
      }
    };
    run();
    return () => { cancelled = true; };
  }, [sessionId]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 grid place-items-center px-6 pad-bottom-safe">
      <div className="max-w-sm w-full text-center space-y-5">
        {phase === "loading" ? (
          <>
            <Loader2 className="h-12 w-12 mx-auto animate-spin text-primary" />
            <p className="text-muted-foreground">Confirming your payment…</p>
          </>
        ) : phase === "failed" ? (
          <>
            <p className="text-lg font-semibold">Payment didn't complete</p>
            <Button onClick={() => nav(-1)}>Try again</Button>
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
              <p className="text-sm text-muted-foreground">
                {receiptNumber ? <>Receipt <span className="font-mono">{receiptNumber}</span> is ready.</> : "Your receipt is ready."}
              </p>
            </div>
            {intentId && (
              <Button variant="outline" className="w-full" onClick={() => nav(`/receipt/${intentId}`)}>
                <FileText className="h-4 w-4 mr-2" /> View receipt
              </Button>
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