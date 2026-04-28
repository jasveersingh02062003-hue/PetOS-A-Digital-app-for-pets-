import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { CheckCircle2, Loader2, Sparkles } from "lucide-react";
import { format } from "date-fns";
import { PaywallSheet } from "@/components/PaywallSheet";

const DEFAULT_TERMS = `Both parties confirm:
• Their pet is healthy, fully vaccinated, and free from communicable conditions to the best of their knowledge.
• This agreement is an introduction only — Petos is not a party to any private arrangement, fee, or outcome.
• Both parties will treat the other pet and owner with respect and arrange a meeting in a safe, neutral location.`;

export const AgreementCard = ({
  requestId,
  isFromOwner,
  contactInfo,
}: {
  requestId: string;
  isFromOwner: boolean;
  contactInfo?: { name: string; phone?: string | null };
}) => {
  const { user } = useAuth();
  const [agreement, setAgreement] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [signing, setSigning] = useState(false);
  const [paywallOpen, setPaywallOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from("mating_agreements").select("*").eq("request_id", requestId).maybeSingle();
      if (!cancelled) {
        setAgreement(data);
        setLoading(false);
      }
    })();
    const ch = supabase.channel(`agreement:${requestId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "mating_agreements", filter: `request_id=eq.${requestId}` },
        (p) => setAgreement(p.new))
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, [requestId]);

  const startSign = () => {
    if (!name.trim() || !agreed) return toast.error("Type your name and tick the box");
    // Charge only on first creation; subsequent counter-signature is free.
    if (!agreement) setPaywallOpen(true);
    else finishSign();
  };

  const finishSign = async (): Promise<void> => {
    setSigning(true);
    const sigField = isFromOwner ? "from_signature" : "to_signature";
    const tsField = isFromOwner ? "from_signed_at" : "to_signed_at";
    const nowIso = new Date().toISOString();
    if (!agreement) {
      const insertPayload: any = {
        request_id: requestId,
        terms_text: DEFAULT_TERMS,
        [sigField]: name.trim(),
        [tsField]: nowIso,
      };
      const { data, error } = await supabase.from("mating_agreements").insert(insertPayload).select().single();
      setSigning(false);
      if (error) { toast.error(error.message); return; }
      setAgreement(data);
    } else {
      const updatePayload: any = { [sigField]: name.trim(), [tsField]: nowIso };
      const { data, error } = await supabase.from("mating_agreements").update(updatePayload).eq("id", agreement.id).select().single();
      setSigning(false);
      if (error) { toast.error(error.message); return; }
      setAgreement(data);
    }
    toast.success("Signed");
  };

  if (loading) return <Card className="rounded-2xl border-hairline bg-card p-4"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></Card>;

  const mySig = isFromOwner ? agreement?.from_signature : agreement?.to_signature;
  const theirSig = isFromOwner ? agreement?.to_signature : agreement?.from_signature;
  const mySignedAt = isFromOwner ? agreement?.from_signed_at : agreement?.to_signed_at;
  const theirSignedAt = isFromOwner ? agreement?.to_signed_at : agreement?.from_signed_at;
  const fullySigned = mySig && theirSig;

  return (
    <>
    <Card className="rounded-2xl border-hairline bg-card shadow-none p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <div className="font-display text-lg">Mating intent agreement</div>
      </div>
      <p className="text-xs text-muted-foreground whitespace-pre-line">{agreement?.terms_text ?? DEFAULT_TERMS}</p>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <SigBox label="You" sig={mySig} at={mySignedAt} />
        <SigBox label="Other party" sig={theirSig} at={theirSignedAt} />
      </div>

      {!mySig && (
        <div className="space-y-2 pt-1">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Type your full name" className="h-11 rounded-xl border-hairline" />
          <label className="flex items-start gap-2 text-xs text-muted-foreground">
            <Checkbox checked={agreed} onCheckedChange={(v) => setAgreed(!!v)} className="mt-0.5" />
            <span>I have read and agree to these terms.</span>
          </label>
          <Button onClick={startSign} disabled={signing || !name.trim() || !agreed} size="lg" className="w-full rounded-xl">
            {signing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign agreement"}
          </Button>
        </div>
      )}

      {fullySigned && contactInfo && (
        <Card className="rounded-xl border-primary/30 bg-primary-soft p-3">
          <div className="flex items-center gap-2 text-sm font-medium text-primary mb-1">
            <CheckCircle2 className="h-4 w-4" /> Contact unlocked
          </div>
          <div className="text-sm">{contactInfo.name}</div>
          {contactInfo.phone && <div className="text-sm text-muted-foreground">{contactInfo.phone}</div>}
        </Card>
      )}
    </Card>
    <PaywallSheet
      open={paywallOpen}
      onOpenChange={setPaywallOpen}
      kind="agreement"
      refId={requestId}
      onConfirmed={finishSign}
    />
    </>
  );
};

const SigBox = ({ label, sig, at }: { label: string; sig?: string; at?: string }) => (
  <div className={`rounded-xl border p-2 ${sig ? "border-primary/30 bg-primary-soft" : "border-hairline border-dashed"}`}>
    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
    {sig ? (
      <>
        <div className="font-display text-sm truncate">{sig}</div>
        {at && <div className="text-[10px] text-muted-foreground">{format(new Date(at), "d MMM, h:mm a")}</div>}
      </>
    ) : (
      <div className="text-xs text-muted-foreground">Awaiting signature</div>
    )}
  </div>
);
