import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTier } from "@/hooks/useTier";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Sparkles, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";

const Billing = () => {
  const nav = useNavigate();
  const { data: tier } = useTier();
  const [working, setWorking] = useState(false);

  const openPortal = async () => {
    setWorking(true);
    try {
      const { data, error } = await supabase.functions.invoke("billing-portal", { body: {} });
      if (error) throw error;
      if (data?.status === "not_configured") {
        toast.message("Billing portal isn't live yet — email hello@petos.app to manage your plan.");
        setWorking(false);
        return;
      }
      if (data?.url) { window.location.href = data.url; return; }
      throw new Error("Couldn't open billing portal");
    } catch (e: any) {
      toast.error(e?.message ?? "Something went wrong");
      setWorking(false);
    }
  };

  const isPlus = tier?.tier === "plus";

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-hairline">
        <div className="container-app h-14 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => nav(-1)}><ArrowLeft className="h-5 w-5" /></Button>
          <h1 className="font-display text-xl">Billing</h1>
        </div>
      </header>

      <main className="container-app py-6 space-y-4">
        <Card className="rounded-2xl border-hairline shadow-none p-5">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Current plan</div>
          <div className="flex items-center gap-2 mt-2">
            <div className="font-display text-2xl">{isPlus ? "Petos Plus" : "Free"}</div>
            {isPlus && <Sparkles className="h-4 w-4 text-primary" />}
          </div>
          {isPlus && tier?.currentPeriodEnd && (
            <div className="text-sm text-muted-foreground mt-1">
              {tier.cancelAtPeriodEnd ? "Ends" : "Renews"} on{" "}
              {new Date(tier.currentPeriodEnd).toLocaleDateString(undefined, {
                day: "numeric", month: "short", year: "numeric",
              })}
            </div>
          )}
        </Card>

        {isPlus ? (
          <Button variant="outline" className="w-full h-12 rounded-2xl border-hairline" onClick={openPortal} disabled={working}>
            {working ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ExternalLink className="h-4 w-4 mr-2" />}
            Manage billing
          </Button>
        ) : (
          <Button className="w-full h-12 rounded-2xl" onClick={() => nav("/plus")}>
            <Sparkles className="h-4 w-4 mr-2" /> Upgrade to Plus
          </Button>
        )}

        <Card className="rounded-2xl border-hairline shadow-none p-4">
          <div className="text-xs text-muted-foreground leading-relaxed">
            Payments are securely processed by Stripe. Petos never sees your card details.
            For receipts or refund questions, email <strong>hello@petos.app</strong>.
          </div>
        </Card>
      </main>
    </div>
  );
};

export default Billing;
