import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { CheckCircle2, Loader2, Sparkles, Lock } from "lucide-react";
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
  // Deal-term draft state — editable until both sign
  const [dealType, setDealType] = useState<"free" | "stud_fee" | "puppy_split" | "other">("free");
  const [studFee, setStudFee] = useState<string>("");
  const [ownerPct, setOwnerPct] = useState<string>("50");
  const [partnerPct, setPartnerPct] = useState<string>("50");
  const [meetingDate, setMeetingDate] = useState<string>("");
  const [meetingLocation, setMeetingLocation] = useState<string>("");
  const [extraTerms, setExtraTerms] = useState<string>("");
  const [savingTerms, setSavingTerms] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from("mating_agreements").select("*").eq("request_id", requestId).maybeSingle();
      if (!cancelled) {
        setAgreement(data);
        if (data) hydrateTerms(data);
        setLoading(false);
      }
    })();
    const ch = supabase.channel(`agreement:${requestId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "mating_agreements", filter: `request_id=eq.${requestId}` },
        (p) => { setAgreement(p.new); hydrateTerms(p.new as any); })
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, [requestId]);

  const hydrateTerms = (a: any) => {
    if (!a) return;
    setDealType((a.deal_type ?? "free") as any);
    setStudFee(a.stud_fee_inr != null ? String(a.stud_fee_inr) : "");
    setOwnerPct(a.puppy_split_owner_pct != null ? String(a.puppy_split_owner_pct) : "50");
    setPartnerPct(a.puppy_split_partner_pct != null ? String(a.puppy_split_partner_pct) : "50");
    setMeetingDate(a.meeting_date ?? "");
    setMeetingLocation(a.meeting_location ?? "");
    setExtraTerms(a.extra_terms ?? "");
  };

  const buildTermsPayload = () => {
    const payload: any = {
      deal_type: dealType,
      stud_fee_inr: dealType === "stud_fee" ? Number(studFee) || null : null,
      puppy_split_owner_pct: dealType === "puppy_split" ? Number(ownerPct) || null : null,
      puppy_split_partner_pct: dealType === "puppy_split" ? Number(partnerPct) || null : null,
      meeting_date: meetingDate || null,
      meeting_location: meetingLocation.trim() || null,
      extra_terms: extraTerms.trim() || null,
    };
    return payload;
  };

  const saveTerms = async () => {
    if (!agreement) return;
    if (dealType === "puppy_split" && Number(ownerPct) + Number(partnerPct) !== 100) {
      return toast.error("Puppy split must total 100%");
    }
    if (dealType === "stud_fee" && (!studFee || Number(studFee) <= 0)) {
      return toast.error("Enter a stud fee amount");
    }
    setSavingTerms(true);
    // Saving terms invalidates any existing counter-signature so both parties must re-sign.
    const updates: any = { ...buildTermsPayload() };
    if (agreement.from_signature && agreement.to_signature) {
      // Should never happen — locked once both sign. UI guards this, but be defensive.
      setSavingTerms(false);
      return toast.error("Terms are locked");
    }
    // Clear the *other* party's signature so they re-confirm against the updated terms
    if (isFromOwner && agreement.to_signature) {
      updates.to_signature = null;
      updates.to_signed_at = null;
    } else if (!isFromOwner && agreement.from_signature) {
      updates.from_signature = null;
      updates.from_signed_at = null;
    }
    const { data, error } = await supabase.from("mating_agreements").update(updates).eq("id", agreement.id).select().single();
    setSavingTerms(false);
    if (error) return toast.error(error.message);
    setAgreement(data);
    toast.success("Terms updated");
  };

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
        ...buildTermsPayload(),
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
  const locked = !!agreement?.terms_locked;

  return (
    <>
    <Card className="rounded-2xl border-hairline bg-card shadow-none p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <div className="font-display text-lg">Mating intent agreement</div>
      </div>
      <p className="text-xs text-muted-foreground whitespace-pre-line">{agreement?.terms_text ?? DEFAULT_TERMS}</p>

      {/* Structured deal terms */}
      <Card className="rounded-xl border-hairline bg-muted/30 p-3 space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-xs uppercase tracking-wide text-muted-foreground font-medium">Deal terms</div>
          {locked && (
            <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
              <Lock className="h-3 w-3" /> Locked
            </span>
          )}
        </div>

        <div className="space-y-1.5">
          <Label className="text-[11px] text-muted-foreground">Type</Label>
          <Select value={dealType} onValueChange={(v: any) => setDealType(v)} disabled={locked}>
            <SelectTrigger className="h-10 rounded-lg"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="free">Free / friendly</SelectItem>
              <SelectItem value="stud_fee">Stud fee</SelectItem>
              <SelectItem value="puppy_split">Puppy split</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {dealType === "stud_fee" && (
          <div className="space-y-1.5">
            <Label className="text-[11px] text-muted-foreground">Stud fee (₹)</Label>
            <Input type="number" inputMode="numeric" value={studFee} onChange={(e) => setStudFee(e.target.value)} disabled={locked}
              className="h-10 rounded-lg border-hairline" placeholder="e.g. 15000" />
          </div>
        )}

        {dealType === "puppy_split" && (
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label className="text-[11px] text-muted-foreground">Owner %</Label>
              <Input type="number" inputMode="numeric" value={ownerPct} onChange={(e) => setOwnerPct(e.target.value)} disabled={locked}
                className="h-10 rounded-lg border-hairline" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] text-muted-foreground">Partner %</Label>
              <Input type="number" inputMode="numeric" value={partnerPct} onChange={(e) => setPartnerPct(e.target.value)} disabled={locked}
                className="h-10 rounded-lg border-hairline" />
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <Label className="text-[11px] text-muted-foreground">Meeting date</Label>
            <Input type="date" value={meetingDate} onChange={(e) => setMeetingDate(e.target.value)} disabled={locked}
              className="h-10 rounded-lg border-hairline" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px] text-muted-foreground">Location</Label>
            <Input value={meetingLocation} onChange={(e) => setMeetingLocation(e.target.value)} disabled={locked}
              placeholder="Park, vet clinic…" className="h-10 rounded-lg border-hairline" />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-[11px] text-muted-foreground">Extra terms</Label>
          <Textarea value={extraTerms} onChange={(e) => setExtraTerms(e.target.value)} disabled={locked}
            placeholder="Vet check before mating, payment schedule, pick of litter…" className="rounded-lg border-hairline min-h-[60px]" />
        </div>

        {!locked && agreement && (
          <Button type="button" size="sm" variant="outline" onClick={saveTerms} disabled={savingTerms}
            className="rounded-lg border-hairline w-full">
            {savingTerms ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save terms"}
          </Button>
        )}
      </Card>

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
