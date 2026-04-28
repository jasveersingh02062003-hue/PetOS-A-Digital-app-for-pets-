import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePets } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, ShieldAlert, Loader2, Heart } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { PaywallSheet } from "@/components/PaywallSheet";

const MatesNew = () => {
  const nav = useNavigate();
  const { data: pets } = usePets();
  const [petId, setPetId] = useState<string>("");
  const [intent, setIntent] = useState<"stud" | "dam" | "either">("either");
  const [fee, setFee] = useState<string>("");
  const [city, setCity] = useState("");
  const [travel, setTravel] = useState<string>("0");
  const [description, setDescription] = useState("");
  const [requirements, setRequirements] = useState("");
  const [discoverable, setDiscoverable] = useState(true);
  const [saving, setSaving] = useState(false);
  const [paywallOpen, setPaywallOpen] = useState(false);

  const selected = pets?.find((p) => p.id === petId);
  const isNeutered = !!selected?.neutered;
  const eligible = selected?.vaccination_verified && !isNeutered;

  const startSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return toast.error("Pick a pet first");
    if (!eligible) return toast.error("Verify vaccinations before listing");
    setPaywallOpen(true);
  };

  const finishSubmit = async (): Promise<void> => {
    if (!selected) return;
    setSaving(true);
    if (!selected.discoverable_for_mating || selected.discoverable_for_mating !== discoverable) {
      const { error } = await supabase.from("pets").update({ discoverable_for_mating: discoverable }).eq("id", selected.id);
      if (error) { setSaving(false); toast.error(error.message); return; }
    }
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("mating_listings").insert({
      pet_id: selected.id,
      owner_id: u.user!.id,
      intent,
      fee_inr: fee ? Number(fee) : null,
      city: city.trim() || null,
      travel_km: Number(travel) || 0,
      description: description.trim() || null,
      requirements: requirements.trim() || null,
    });
    setSaving(false);
    if (error) {
      if (error.message.includes("duplicate")) { toast.error("This pet already has a listing"); return; }
      toast.error(error.message); return;
    }
    toast.success("Listing live");
    nav("/discover");
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="container-app pad-top-safe pt-4 pb-3 flex items-center gap-3 border-b border-hairline">
        <Button variant="ghost" size="icon" onClick={() => nav(-1)} className="rounded-full">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <div className="font-display text-lg leading-tight">List for mating</div>
          <div className="text-xs text-muted-foreground">Verified pets only</div>
        </div>
      </header>

      <form onSubmit={startSubmit} className="container-app py-5 space-y-4 pb-12">
        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground font-medium">Pet</Label>
          <Select value={petId} onValueChange={setPetId}>
            <SelectTrigger className="h-12 rounded-xl"><SelectValue placeholder="Select your pet" /></SelectTrigger>
            <SelectContent>
              {pets?.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name} {p.neutered ? "(neutered)" : p.vaccination_verified ? "✓" : "(not verified)"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-[11px] text-muted-foreground pl-1">Neutered pets and unverified pets are not eligible.</p>
        </div>

        {selected && isNeutered && (
          <Card className="rounded-2xl border-amber-500/30 bg-amber-500/5 p-4">
            <div className="flex items-start gap-3">
              <ShieldAlert className="h-5 w-5 text-amber-600 dark:text-amber-300 shrink-0 mt-0.5" />
              <div className="text-sm">
                <div className="font-medium">{selected.name} is marked as neutered</div>
                <p className="text-muted-foreground mt-1">Neutered pets can't be listed for mating. Pick a different pet, or update this in the pet editor if it was a mistake.</p>
              </div>
            </div>
          </Card>
        )}

        {selected && !isNeutered && !selected.vaccination_verified && (
          <Card className="rounded-2xl border-amber-500/30 bg-amber-500/5 p-4">
            <div className="flex items-start gap-3">
              <ShieldAlert className="h-5 w-5 text-amber-600 dark:text-amber-300 shrink-0 mt-0.5" />
              <div className="text-sm">
                <div className="font-medium">Vaccinations not verified</div>
                <p className="text-muted-foreground mt-1">Add up-to-date vaccinations in the Health vault first.</p>
                <Button type="button" variant="link" className="px-0 h-auto mt-1" onClick={() => nav("/health")}>Open vault →</Button>
              </div>
            </div>
          </Card>
        )}

        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground font-medium">Intent</Label>
          <Select value={intent} onValueChange={(v: any) => setIntent(v)}>
            <SelectTrigger className="h-12 rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="stud">Stud (male)</SelectItem>
              <SelectItem value="dam">Dam (female)</SelectItem>
              <SelectItem value="either">Either</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground font-medium">Stud fee (₹)</Label>
            <Input type="number" inputMode="numeric" value={fee} onChange={(e) => setFee(e.target.value)} placeholder="Optional" className="h-12 rounded-xl border-hairline" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground font-medium">Travel km</Label>
            <Input type="number" inputMode="numeric" value={travel} onChange={(e) => setTravel(e.target.value)} className="h-12 rounded-xl border-hairline" />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground font-medium">City</Label>
          <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Bengaluru" className="h-12 rounded-xl border-hairline" />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground font-medium">About your pet</Label>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Friendly, KCI registered, dewormed…" className="rounded-xl border-hairline min-h-[80px]" />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground font-medium">Requirements for partner</Label>
          <Textarea value={requirements} onChange={(e) => setRequirements(e.target.value)} placeholder="Same breed, vaccinated, owner in same city…" className="rounded-xl border-hairline min-h-[70px]" />
        </div>

        <Card className="rounded-2xl border-hairline bg-card p-4 flex items-center justify-between">
          <div>
            <div className="font-medium text-sm">Discoverable for mating</div>
            <div className="text-xs text-muted-foreground">Hides listing if turned off</div>
          </div>
          <Switch checked={discoverable} onCheckedChange={setDiscoverable} />
        </Card>

        <Button type="submit" disabled={saving || !eligible || !petId} size="lg" className="w-full rounded-2xl h-12 gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Heart className="h-4 w-4" />} Publish listing
        </Button>
      </form>
      <PaywallSheet
        open={paywallOpen}
        onOpenChange={setPaywallOpen}
        kind="mating_listing"
        onConfirmed={finishSubmit}
      />
    </div>
  );
};

export default MatesNew;
