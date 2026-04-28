import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Shield, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";

type Partner = {
  id: string;
  name: string;
  logo_url: string | null;
  blurb: string | null;
  plan_min_inr: number | null;
  plan_max_inr: number | null;
  redirect_url: string;
};

export function InsuranceCard({ petId, currentProvider }: { petId: string; currentProvider?: string | null }) {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingId, setPendingId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase
        .from("insurance_partners")
        .select("id,name,logo_url,blurb,plan_min_inr,plan_max_inr,redirect_url")
        .eq("active", true)
        .order("sort_order", { ascending: true });
      if (active) {
        setPartners(data ?? []);
        setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const handleQuote = async (p: Partner) => {
    setPendingId(p.id);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) { toast.error("Sign in required"); return; }
      const { data, error } = await supabase
        .from("insurance_leads")
        .insert({ user_id: u.user.id, pet_id: petId, partner_id: p.id })
        .select("id")
        .single();
      if (error) throw error;
      const url = p.redirect_url.replace("{lead_id}", data!.id);
      window.open(url, "_blank", "noopener,noreferrer");
      toast.success("Opening partner — we'll email follow-ups");
    } catch (e: any) {
      toast.error(e?.message ?? "Could not start quote");
    } finally {
      setPendingId(null);
    }
  };

  if (loading) return null;
  if (partners.length === 0) return null;

  return (
    <Card className="rounded-2xl border-hairline bg-card shadow-none p-5 mb-3">
      <div className="flex items-center gap-2 mb-2">
        <Shield className="h-4 w-4 text-primary" />
        <div className="font-display text-base">Pet insurance</div>
        {currentProvider ? (
          <Badge variant="secondary" className="ml-auto bg-primary-soft text-primary border-0">{currentProvider}</Badge>
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        {currentProvider ? "Compare other plans for your pet." : "Get a quote in seconds from our partners."}
      </p>
      <div className="space-y-2">
        {partners.map((p) => (
          <div key={p.id} className="flex items-center gap-3 p-3 rounded-xl border border-hairline">
            <div className="h-10 w-10 rounded-lg bg-muted overflow-hidden grid place-items-center shrink-0">
              {p.logo_url ? <img src={p.logo_url} alt={p.name} className="h-full w-full object-cover" /> : <Shield className="h-5 w-5 text-muted-foreground" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium truncate">{p.name}</div>
              {p.blurb && <div className="text-[11px] text-muted-foreground line-clamp-1">{p.blurb}</div>}
              {(p.plan_min_inr || p.plan_max_inr) && (
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  ₹{p.plan_min_inr ?? "?"}{p.plan_max_inr ? `–₹${p.plan_max_inr}` : ""}/yr
                </div>
              )}
            </div>
            <Button
              size="sm"
              variant="outline"
              className="rounded-full gap-1 shrink-0"
              onClick={() => handleQuote(p)}
              disabled={pendingId === p.id}
            >
              {pendingId === p.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ExternalLink className="h-3.5 w-3.5" />}
              Quote
            </Button>
          </div>
        ))}
      </div>
    </Card>
  );
}