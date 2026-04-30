import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Shield, ExternalLink, Loader2, Clock, FileText, ShieldCheck } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { PhotoUploadField } from "./PhotoUploadField";

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
  const { user } = useAuth();
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [claimOpen, setClaimOpen] = useState(false);

  const { data: leads = [] } = useQuery({
    queryKey: ["insurance-leads", petId],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("insurance_leads")
        .select("id,status,partner_id,policy_number,premium_inr,expires_on,created_at,partner_ref")
        .eq("pet_id", petId)
        .order("created_at", { ascending: false });
      return (data ?? []) as any[];
    },
  });

  const activeLead = leads.find((l) => l.status === "bound" || !!l.policy_number);
  const pendingLead = !activeLead && leads.find((l) => ["new", "in_progress", "quoted"].includes(l.status));

  const { data: claims = [] } = useQuery({
    queryKey: ["insurance-claims", petId],
    enabled: !!user && !!activeLead,
    queryFn: async () => {
      const { data } = await supabase
        .from("insurance_claims" as any)
        .select("*")
        .eq("pet_id", petId)
        .order("submitted_at", { ascending: false });
      return (data ?? []) as any[];
    },
  });

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

  // ===== ACTIVE POLICY =====
  if (activeLead) {
    const partner = partners.find((p) => p.id === activeLead.partner_id);
    return (
      <>
        <Card className="rounded-2xl border-hairline bg-card shadow-none p-5 mb-3">
          <div className="flex items-center gap-2 mb-2">
            <ShieldCheck className="h-4 w-4 text-leaf" />
            <div className="font-display text-base">Active policy</div>
            <Badge variant="secondary" className="ml-auto bg-leaf/15 text-leaf border-0">Insured</Badge>
          </div>
          <div className="text-sm">
            <div className="font-medium">{partner?.name ?? currentProvider ?? "Insurer"}</div>
            {activeLead.policy_number && (
              <div className="text-xs text-muted-foreground mt-0.5 font-mono">#{activeLead.policy_number}</div>
            )}
            {activeLead.expires_on && (
              <div className="text-xs text-muted-foreground">
                Renews {format(new Date(activeLead.expires_on), "d MMM yyyy")}
              </div>
            )}
          </div>
          <Button onClick={() => setClaimOpen(true)} className="w-full rounded-xl mt-3 gap-2">
            <FileText className="h-4 w-4" /> File a claim
          </Button>

          {claims.length > 0 && (
            <div className="mt-3 pt-3 border-t border-hairline space-y-1.5">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Recent claims</div>
              {claims.slice(0, 3).map((c: any) => (
                <div key={c.id} className="flex items-center justify-between text-sm">
                  <span className="truncate">₹{Number(c.amount_inr).toLocaleString("en-IN")}</span>
                  <Badge variant="outline" className="text-[10px] capitalize">{c.status.replace("_", " ")}</Badge>
                </div>
              ))}
            </div>
          )}
        </Card>
        <ClaimDialog open={claimOpen} onOpenChange={setClaimOpen} petId={petId} leadId={activeLead.id} />
      </>
    );
  }

  // ===== LEAD PENDING =====
  if (pendingLead) {
    const partner = partners.find((p) => p.id === pendingLead.partner_id);
    return (
      <Card className="rounded-2xl border-hairline bg-card shadow-none p-5 mb-3">
        <div className="flex items-center gap-2 mb-2">
          <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <div className="font-display text-base">Quote in progress</div>
        </div>
        <p className="text-xs text-muted-foreground">
          {partner?.name ?? "The partner"} is preparing your quote. We'll switch this card to your
          active policy once it's bound.
        </p>
      </Card>
    );
  }

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
              {p.logo_url ? <img src={p.logo_url} alt={p.name} className="h-full w-full object-cover" loading="lazy" decoding="async" /> : <Shield className="h-5 w-5 text-muted-foreground" />}
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

function ClaimDialog({ open, onOpenChange, petId, leadId }: { open: boolean; onOpenChange: (b: boolean) => void; petId: string; leadId: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [amount, setAmount] = useState("");
  const [desc, setDesc] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const a = parseFloat(amount);
    if (!a || a <= 0) return toast.error("Enter a valid amount");
    setSaving(true);
    const { error } = await supabase.from("insurance_claims" as any).insert({
      pet_id: petId,
      owner_id: user!.id,
      lead_id: leadId,
      amount_inr: a,
      description: desc.trim() || null,
      photo_paths: photos.length ? photos : null,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Claim submitted");
    qc.invalidateQueries({ queryKey: ["insurance-claims", petId] });
    setAmount(""); setDesc(""); setPhotos([]);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl">
        <DialogHeader><DialogTitle className="font-display">File a claim</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground font-medium">Amount (₹)</Label>
            <Input type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className="h-12 rounded-xl border-hairline" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground font-medium">What happened?</Label>
            <Textarea value={desc} onChange={(e) => setDesc(e.target.value)} className="rounded-xl border-hairline min-h-[80px]" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground font-medium">Receipts / reports</Label>
            <PhotoUploadField value={photos} onChange={setPhotos} />
          </div>
          <Button onClick={submit} disabled={saving} size="lg" className="w-full rounded-xl">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit claim"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}