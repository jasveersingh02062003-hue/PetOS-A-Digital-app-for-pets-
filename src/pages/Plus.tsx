import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTier } from "@/hooks/useTier";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Sparkles, Check, Loader2, BellRing } from "lucide-react";
import { toast } from "sonner";

const PERKS = [
  { title: "Unlimited AI chats", desc: "Ask anything about your pet, anytime — no daily cap." },
  { title: "2 vet consults / month", desc: "Real licensed vets reply in hours. Worth ₹400/month." },
  { title: "Unlimited missing-pet alerts", desc: "List as many pets as you need, with wider-radius push." },
  { title: "Custom vault sharing", desc: "Share records with vets for up to 7 days, your call." },
  { title: "Plus badge", desc: "A subtle mark of trust on your profile and posts." },
  { title: "Priority in mating discovery", desc: "Your pet appears earlier in matched searches." },
];

const FAQ = [
  { q: "Can I cancel anytime?", a: "Yes. Cancel from Settings → Billing in two taps. You keep Plus until your current period ends." },
  { q: "What happens to my free features?", a: "Everything free stays free, forever. Plus is purely additive." },
  { q: "Are vet consults really included?", a: "Yes — 2 per month, with real licensed vets. Unused consults don't roll over." },
  { q: "Is my payment secure?", a: "Payments are processed by Stripe. Petos never sees or stores your card details." },
];

const Plus = () => {
  const nav = useNavigate();
  const { user } = useAuth();
  const { data: tier } = useTier();
  const [billing, setBilling] = useState<"monthly" | "yearly">("yearly");
  const [working, setWorking] = useState(false);

  const { data: notifyState } = useQuery({
    queryKey: ["notify-plus", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles").select("notify_plus_launch").eq("id", user!.id).maybeSingle();
      return !!data?.notify_plus_launch;
    },
  });

  const upgrade = async () => {
    if (!user) return nav("/auth");
    setWorking(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: { plan: billing === "yearly" ? "plus_yearly" : "plus_monthly" },
      });
      if (error) throw error;
      if (data?.status === "not_configured") {
        // Calm placeholder — flip notify flag instead of fake checkout
        await supabase.from("profiles").update({ notify_plus_launch: true }).eq("id", user.id);
        toast.success("We'll email you the moment Plus opens. No charge today.");
        setWorking(false);
        return;
      }
      if (data?.url) {
        window.location.href = data.url;
        return;
      }
      throw new Error("Couldn't start checkout");
    } catch (e: any) {
      toast.error(e?.message ?? "Something went wrong");
      setWorking(false);
    }
  };

  const isPlus = tier?.tier === "plus";
  const monthlyPrice = 299;
  const yearlyPrice = 2499; // ~30% off
  const yearlyMonthlyEquivalent = Math.round(yearlyPrice / 12);

  return (
    <div className="min-h-screen bg-background pad-bottom-safe">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-hairline">
        <div className="container-app h-14 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => nav(-1)}><ArrowLeft className="h-5 w-5" /></Button>
          <h1 className="font-display text-xl">Petos Plus</h1>
        </div>
      </header>

      <main className="container-app py-8 space-y-8">
        {/* Hero */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center h-14 w-14 rounded-full bg-primary/10">
            <Sparkles className="h-6 w-6 text-primary" strokeWidth={1.8} />
          </div>
          <h2 className="font-display text-3xl leading-tight">Care without limits</h2>
          <p className="text-sm text-muted-foreground max-w-xs mx-auto">
            Everything in Petos, plus unlimited AI, real vet consults, and a louder voice in your community.
          </p>
        </div>

        {isPlus ? (
          <Card className="rounded-2xl border-primary/30 bg-primary/5 shadow-none p-5 text-center">
            <div className="font-display text-lg text-primary">You're on Plus 💚</div>
            <p className="text-sm text-muted-foreground mt-1">
              {tier?.currentPeriodEnd
                ? `Renews on ${new Date(tier.currentPeriodEnd).toLocaleDateString()}`
                : "Enjoy unlimited everything."}
            </p>
            <Button variant="outline" className="mt-4 rounded-xl border-hairline" onClick={() => nav("/settings/billing")}>
              Manage billing
            </Button>
          </Card>
        ) : (
          <>
            {/* Billing toggle */}
            <div className="flex items-center justify-center">
              <div className="inline-flex bg-muted rounded-full p-1">
                <button
                  onClick={() => setBilling("monthly")}
                  className={`px-4 py-1.5 text-sm rounded-full transition-colors ${billing === "monthly" ? "bg-background shadow-sm font-medium" : "text-muted-foreground"}`}
                >
                  Monthly
                </button>
                <button
                  onClick={() => setBilling("yearly")}
                  className={`px-4 py-1.5 text-sm rounded-full transition-colors ${billing === "yearly" ? "bg-background shadow-sm font-medium" : "text-muted-foreground"}`}
                >
                  Yearly · Save ~30%
                </button>
              </div>
            </div>

            {/* Pricing card */}
            <Card className="rounded-3xl border-hairline shadow-none p-6">
              <div className="flex items-baseline justify-between">
                <div>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">Petos Plus</div>
                  <div className="font-display text-4xl mt-1">
                    ₹{billing === "yearly" ? yearlyMonthlyEquivalent : monthlyPrice}
                    <span className="text-base text-muted-foreground font-sans"> / month</span>
                  </div>
                  {billing === "yearly" && (
                    <div className="text-xs text-muted-foreground mt-1">Billed ₹{yearlyPrice} yearly</div>
                  )}
                </div>
              </div>

              <Button
                className="w-full h-12 rounded-2xl mt-5"
                disabled={working}
                onClick={upgrade}
              >
                {working ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {notifyState ? "We'll notify you on launch" : "Upgrade to Plus"}
              </Button>
              <p className="text-[11px] text-muted-foreground text-center mt-2">
                Cancel anytime · Secure checkout via Stripe
              </p>
            </Card>

            {notifyState && (
              <Card className="rounded-2xl border-hairline bg-primary/5 shadow-none p-4 flex items-start gap-3">
                <BellRing className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <div>
                  <div className="font-medium text-sm">You're on the launch list</div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    We'll email you the moment Plus opens. No card needed today.
                  </p>
                </div>
              </Card>
            )}
          </>
        )}

        {/* Perks */}
        <div className="space-y-3">
          <h3 className="font-display text-xl">What you get</h3>
          {PERKS.map((p) => (
            <div key={p.title} className="flex items-start gap-3">
              <span className="mt-0.5 h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Check className="h-3 w-3 text-primary" strokeWidth={3} />
              </span>
              <div>
                <div className="font-medium text-sm">{p.title}</div>
                <div className="text-xs text-muted-foreground">{p.desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* FAQ */}
        <div className="space-y-3">
          <h3 className="font-display text-xl">Questions</h3>
          <div className="space-y-3">
            {FAQ.map((f) => (
              <Card key={f.q} className="rounded-2xl border-hairline shadow-none p-4">
                <div className="font-medium text-sm">{f.q}</div>
                <p className="text-xs text-muted-foreground mt-1">{f.a}</p>
              </Card>
            ))}
          </div>
        </div>

        <p className="text-[11px] text-muted-foreground text-center">
          Free forever: social feed, mating discovery, basic AI, vault & 24h vet sharing.
        </p>
      </main>
    </div>
  );
};

export default Plus;
