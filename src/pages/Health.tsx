import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usePets } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Heart, MessageSquare, ShieldCheck, Syringe, Utensils, Activity, FileText, Plus, QrCode, Share2, Loader2, Calendar, Trash2, Copy, Pill, Bug, ListOrdered, Stethoscope, Sparkles, Siren, PhoneCall } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { format } from "date-fns";
import { MedicalDisclaimer } from "@/components/MedicalDisclaimer";
import { PetIdButton } from "@/components/health/PetIdCard";
import { VitalsTab } from "@/components/health/VitalsTab";
import { MedicationsTab } from "@/components/health/MedicationsTab";
import { ParasiteTab } from "@/components/health/ParasiteTab";
import { ScanVaccinationsDialog } from "@/components/health/ScanVaccinationsDialog";
import { ExportHealthPdfButton } from "@/components/health/ExportHealthPdfButton";
import { InsuranceCard } from "@/components/health/InsuranceCard";

const Health = () => {
  const { data: pets } = usePets();
  const [activeIdx, setActiveIdx] = useState(0);
  const active = pets?.[activeIdx];
  const nav = useNavigate();

  return (
    <div className="container-app pad-top-safe">
      <header className="pt-6 pb-4 flex items-center justify-between">
        <h1 className="font-display text-3xl">Health vault</h1>
        <Heart className="h-5 w-5 text-primary" strokeWidth={1.5} />
      </header>

      {pets && pets.length > 0 && (
        <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-5 px-5 mb-5">
          {pets.map((p, i) => (
            <button
              key={p.id}
              onClick={() => setActiveIdx(i)}
              className={`shrink-0 px-4 py-2 rounded-full text-sm border transition-colors ${i === activeIdx ? "bg-primary text-primary-foreground border-primary" : "bg-card border-hairline text-foreground"}`}
            >
              {p.name}
            </button>
          ))}
        </div>
      )}

      {!active ? (
        <Card className="rounded-2xl border-hairline bg-card shadow-none p-8 text-center">
          <div className="font-display text-lg">Add a pet to begin</div>
          <p className="text-sm text-muted-foreground mt-1">Vault, AI, and consults appear here.</p>
        </Card>
      ) : (
        <>
          <Card className="rounded-2xl border-hairline bg-card shadow-none p-5 mb-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <div className="font-display text-2xl">{active.name}</div>
                  {active.vaccination_verified && (
                    <Badge variant="secondary" className="bg-primary-soft text-primary border-0 gap-1">
                      <ShieldCheck className="h-3 w-3" /> Verified
                    </Badge>
                  )}
                </div>
                <div className="text-sm text-muted-foreground">
                  {[active.breed, active.species].filter(Boolean).join(" · ")}
                </div>
                {(active as any).public_id && (
                  <div className="text-[11px] text-muted-foreground mt-1 tracking-wider font-mono">{(active as any).public_id}</div>
                )}
              </div>
              <div className="flex flex-col gap-2 shrink-0">
                <PetIdButton publicId={(active as any).public_id} petName={active.name} />
                <VetShareButton petId={active.id} petName={active.name} />
                <ExportHealthPdfButton petId={active.id} petName={active.name} />
              </div>
            </div>
          </Card>

          <div className="grid grid-cols-2 gap-2 mb-3">
            <Button onClick={() => nav(`/health/${active.id}/timeline`)} variant="outline" className="rounded-2xl h-12 justify-center gap-2 border-hairline">
              <ListOrdered className="h-4 w-4" />
              <span className="text-sm">Timeline</span>
            </Button>
            <Button onClick={() => nav(`/book-vet?pet=${active.id}`)} variant="outline" className="rounded-2xl h-12 justify-center gap-2 border-hairline">
              <Stethoscope className="h-4 w-4" />
              <span className="text-sm">Book a vet</span>
            </Button>
          </div>

          <Button onClick={() => nav("/ai")} size="lg" className="w-full rounded-2xl h-14 mb-5 justify-start gap-3">
            <MessageSquare className="h-5 w-5" strokeWidth={1.75} />
            <div className="text-left">
              <div className="font-medium">Ask the AI assistant</div>
              <div className="text-xs opacity-80">Personalised to {active.name}</div>
            </div>
          </Button>

          <InsuranceCard petId={active.id} currentProvider={(active as any).insurance_provider} />

          <div className="mb-5"><MedicalDisclaimer variant="inline" /></div>

          <Tabs defaultValue="vitals" className="w-full">
            <div className="overflow-x-auto no-scrollbar -mx-5 px-5">
              <TabsList className="inline-flex w-max bg-muted rounded-xl h-11 p-1">
                <TabsTrigger value="vitals" className="rounded-lg gap-1.5 text-xs px-3"><Heart className="h-3.5 w-3.5" />Vitals</TabsTrigger>
                <TabsTrigger value="vaccinations" className="rounded-lg gap-1.5 text-xs px-3"><Syringe className="h-3.5 w-3.5" />Vax</TabsTrigger>
                <TabsTrigger value="meds" className="rounded-lg gap-1.5 text-xs px-3"><Pill className="h-3.5 w-3.5" />Meds</TabsTrigger>
                <TabsTrigger value="parasite" className="rounded-lg gap-1.5 text-xs px-3"><Bug className="h-3.5 w-3.5" />Parasite</TabsTrigger>
                <TabsTrigger value="symptoms" className="rounded-lg gap-1.5 text-xs px-3"><Activity className="h-3.5 w-3.5" />Symptoms</TabsTrigger>
                <TabsTrigger value="nutrition" className="rounded-lg gap-1.5 text-xs px-3"><Utensils className="h-3.5 w-3.5" />Food</TabsTrigger>
                <TabsTrigger value="records" className="rounded-lg gap-1.5 text-xs px-3"><FileText className="h-3.5 w-3.5" />Records</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="vitals" className="mt-4"><VitalsTab petId={active.id} /></TabsContent>
            <TabsContent value="vaccinations" className="mt-4"><VaccinationsTab petId={active.id} /></TabsContent>
            <TabsContent value="meds" className="mt-4"><MedicationsTab petId={active.id} /></TabsContent>
            <TabsContent value="parasite" className="mt-4"><ParasiteTab petId={active.id} /></TabsContent>
            <TabsContent value="symptoms" className="mt-4"><SymptomsTab petId={active.id} /></TabsContent>
            <TabsContent value="nutrition" className="mt-4"><NutritionTab petId={active.id} /></TabsContent>
            <TabsContent value="records" className="mt-4"><RecordsTab petId={active.id} /></TabsContent>
          </Tabs>

          <ConsultsList petId={active.id} />
        </>
      )}
    </div>
  );
};

/* ============== VACCINATIONS ============== */
const VaccinationsTab = ({ petId }: { petId: string }) => {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ["vaccinations", petId],
    queryFn: async () => {
      const { data, error } = await supabase.from("vaccinations").select("*").eq("pet_id", petId).order("administered_on", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <Button onClick={() => setScanOpen(true)} variant="outline" size="lg"
          className="h-12 rounded-xl border-hairline gap-2 border-primary/40 text-primary hover:bg-primary-soft">
          <Sparkles className="h-4 w-4" /> Scan card
        </Button>
        <Button onClick={() => setOpen(true)} variant="outline" size="lg"
          className="h-12 rounded-xl border-hairline gap-2">
          <Plus className="h-4 w-4" /> Add manually
        </Button>
      </div>
      {isLoading ? <SkeletonList /> : !data?.length ? <EmptyState text="No vaccinations recorded" /> : data.map((v) => (
        <Card key={v.id} className="rounded-2xl border-hairline bg-card shadow-none p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="font-medium">{v.vaccine_name}</div>
              <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                <Calendar className="h-3 w-3" /> {format(new Date(v.administered_on), "d MMM yyyy")}
                {v.next_due_on && <> · next {format(new Date(v.next_due_on), "d MMM yyyy")}</>}
              </div>
              {v.vet_name && <div className="text-xs text-muted-foreground mt-1">Vet: {v.vet_name}</div>}
            </div>
            <DeleteBtn table="vaccinations" id={v.id} invalidate={["vaccinations", petId]} />
          </div>
        </Card>
      ))}
      <VaccinationDialog open={open} onOpenChange={setOpen} petId={petId} />
      <ScanVaccinationsDialog open={scanOpen} onOpenChange={setScanOpen} petId={petId} />
    </div>
  );
};

const VaccinationDialog = ({ open, onOpenChange, petId }: { open: boolean; onOpenChange: (b: boolean) => void; petId: string }) => {
  const qc = useQueryClient();
  const [form, setForm] = useState({ vaccine_name: "", administered_on: new Date().toISOString().slice(0, 10), next_due_on: "", vet_name: "", batch_number: "" });
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.vaccine_name.trim()) return toast.error("Vaccine name required");
    setSaving(true);
    const { error } = await supabase.from("vaccinations").insert({
      pet_id: petId,
      vaccine_name: form.vaccine_name.trim(),
      administered_on: form.administered_on,
      next_due_on: form.next_due_on || null,
      vet_name: form.vet_name.trim() || null,
      batch_number: form.batch_number.trim() || null,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Vaccination saved");
    qc.invalidateQueries({ queryKey: ["vaccinations", petId] });
    onOpenChange(false);
    setForm({ vaccine_name: "", administered_on: new Date().toISOString().slice(0, 10), next_due_on: "", vet_name: "", batch_number: "" });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl">
        <DialogHeader><DialogTitle className="font-display">Add vaccination</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <FormField label="Vaccine name" value={form.vaccine_name} onChange={(v) => setForm({ ...form, vaccine_name: v })} placeholder="DHPPi, Rabies…" />
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Date given" type="date" value={form.administered_on} onChange={(v) => setForm({ ...form, administered_on: v })} />
            <FormField label="Next due" type="date" value={form.next_due_on} onChange={(v) => setForm({ ...form, next_due_on: v })} />
          </div>
          <FormField label="Vet name" value={form.vet_name} onChange={(v) => setForm({ ...form, vet_name: v })} />
          <FormField label="Batch / Lot" value={form.batch_number} onChange={(v) => setForm({ ...form, batch_number: v })} />
          <Button type="submit" disabled={saving} size="lg" className="w-full rounded-xl mt-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

/* ============== RECORDS ============== */
const RecordsTab = ({ petId }: { petId: string }) => {
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ["records", petId],
    queryFn: async () => {
      const { data, error } = await supabase.from("health_records").select("*").eq("pet_id", petId).order("occurred_on", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="space-y-3">
      <AddButton label="Add record" onClick={() => setOpen(true)} />
      {isLoading ? <SkeletonList /> : !data?.length ? <EmptyState text="No records yet" /> : data.map((r) => (
        <Card key={r.id} className="rounded-2xl border-hairline bg-card shadow-none p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <div className="font-medium">{r.title}</div>
                <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">{r.record_type}</Badge>
              </div>
              <div className="text-xs text-muted-foreground mt-1">{format(new Date(r.occurred_on), "d MMM yyyy")}</div>
              {r.notes && <p className="text-sm mt-2 text-ink-soft">{r.notes}</p>}
            </div>
            <DeleteBtn table="health_records" id={r.id} invalidate={["records", petId]} />
          </div>
        </Card>
      ))}
      <RecordDialog open={open} onOpenChange={setOpen} petId={petId} />
    </div>
  );
};

const RecordDialog = ({ open, onOpenChange, petId }: { open: boolean; onOpenChange: (b: boolean) => void; petId: string }) => {
  const qc = useQueryClient();
  const [form, setForm] = useState({ title: "", record_type: "visit", occurred_on: new Date().toISOString().slice(0, 10), notes: "" });
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return toast.error("Title required");
    setSaving(true);
    const { error } = await supabase.from("health_records").insert({
      pet_id: petId,
      title: form.title.trim(),
      record_type: form.record_type as any,
      occurred_on: form.occurred_on,
      notes: form.notes.trim() || null,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Record added");
    qc.invalidateQueries({ queryKey: ["records", petId] });
    onOpenChange(false);
    setForm({ title: "", record_type: "visit", occurred_on: new Date().toISOString().slice(0, 10), notes: "" });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl">
        <DialogHeader><DialogTitle className="font-display">Add health record</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <FormField label="Title" value={form.title} onChange={(v) => setForm({ ...form, title: v })} placeholder="Annual check-up" />
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground font-medium">Type</Label>
            <Select value={form.record_type} onValueChange={(v) => setForm({ ...form, record_type: v })}>
              <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                {["visit", "diagnostic", "prescription", "surgery", "allergy", "other"].map((t) => (
                  <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <FormField label="Date" type="date" value={form.occurred_on} onChange={(v) => setForm({ ...form, occurred_on: v })} />
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground font-medium">Notes</Label>
            <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="rounded-xl border-hairline min-h-[80px]" />
          </div>
          <Button type="submit" disabled={saving} size="lg" className="w-full rounded-xl mt-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

/* ============== SYMPTOMS ============== */
const SymptomsTab = ({ petId }: { petId: string }) => {
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ["symptoms", petId],
    queryFn: async () => {
      const { data, error } = await supabase.from("symptom_logs").select("*").eq("pet_id", petId).order("logged_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const emergency = (data ?? []).find(
    (s: any) =>
      s.ai_flag === "emergency" &&
      Date.now() - new Date(s.logged_at).getTime() < 48 * 3600_000,
  );

  return (
    <div className="space-y-3">
      {emergency && (
        <Card className="rounded-2xl border-2 border-destructive bg-destructive/5 p-4">
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 rounded-full bg-destructive text-destructive-foreground grid place-items-center shrink-0">
              <Siren className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-destructive">Possible emergency</div>
              <p className="text-sm text-foreground mt-0.5">{emergency.symptom}</p>
              {emergency.ai_reason && (
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{emergency.ai_reason}</p>
              )}
              <div className="flex gap-2 mt-3">
                <Button asChild size="sm" className="rounded-full gap-1.5 h-8">
                  <a href="tel:"><PhoneCall className="h-3.5 w-3.5" /> Call vet</a>
                </Button>
                <Button asChild size="sm" variant="outline" className="rounded-full gap-1.5 h-8 border-destructive/30">
                  <a href="/askvet/new"><Stethoscope className="h-3.5 w-3.5" /> Ask vet now</a>
                </Button>
              </div>
            </div>
          </div>
        </Card>
      )}
      <AddButton label="Log symptom" onClick={() => setOpen(true)} />
      {isLoading ? <SkeletonList /> : !data?.length ? <EmptyState text="No symptoms logged" /> : data.map((s) => (
        <Card key={s.id} className="rounded-2xl border-hairline bg-card shadow-none p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="font-medium">{s.symptom}</div>
                <SeverityDots level={s.severity} />
                <FlagChip flag={(s as any).ai_flag} />
              </div>
              <div className="text-xs text-muted-foreground mt-1">{format(new Date(s.logged_at), "d MMM, h:mm a")}</div>
              {s.notes && <p className="text-sm mt-2 text-ink-soft">{s.notes}</p>}
              {(s as any).ai_reason && (s as any).ai_flag && (s as any).ai_flag !== "watch" && (
                <p className="text-xs text-muted-foreground mt-1.5 italic">AI: {(s as any).ai_reason}</p>
              )}
            </div>
            <DeleteBtn table="symptom_logs" id={s.id} invalidate={["symptoms", petId]} />
          </div>
        </Card>
      ))}
      <SymptomDialog open={open} onOpenChange={setOpen} petId={petId} />
    </div>
  );
};

const SymptomDialog = ({ open, onOpenChange, petId }: { open: boolean; onOpenChange: (b: boolean) => void; petId: string }) => {
  const qc = useQueryClient();
  const [form, setForm] = useState({ symptom: "", severity: 2, notes: "" });
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.symptom.trim()) return toast.error("Symptom required");
    setSaving(true);
    const { data: ins, error } = await supabase.from("symptom_logs").insert({
      pet_id: petId,
      symptom: form.symptom.trim(),
      severity: form.severity,
      notes: form.notes.trim() || null,
    }).select("id").single();
    if (error) { setSaving(false); return toast.error(error.message); }
    toast.success("Symptom logged");
    try {
      const { data: ai } = await supabase.functions.invoke("ai-symptom-classify", {
        body: { log_id: ins.id },
      });
      if (ai?.flag === "emergency") {
        toast.error("AI flagged this as a possible emergency — see banner above.", { duration: 8000 });
      } else if (ai?.flag === "vet_soon") {
        toast.warning("AI suggests booking a vet within 24-48h.");
      }
    } catch { /* non-blocking */ }
    setSaving(false);
    qc.invalidateQueries({ queryKey: ["symptoms", petId] });
    onOpenChange(false);
    setForm({ symptom: "", severity: 2, notes: "" });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl">
        <DialogHeader><DialogTitle className="font-display">Log symptom</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <FormField label="Symptom" value={form.symptom} onChange={(v) => setForm({ ...form, symptom: v })} placeholder="Vomiting, lethargy…" />
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground font-medium">Severity</Label>
              <SeverityDots level={form.severity} />
            </div>
            <Slider value={[form.severity]} onValueChange={(v) => setForm({ ...form, severity: v[0] })} min={1} max={5} step={1} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground font-medium">Notes</Label>
            <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="rounded-xl border-hairline min-h-[70px]" />
          </div>
          <Button type="submit" disabled={saving} size="lg" className="w-full rounded-xl">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

const SeverityDots = ({ level }: { level: number }) => (
  <div className="flex gap-0.5">
    {[1, 2, 3, 4, 5].map((i) => (
      <div key={i} className={`h-1.5 w-1.5 rounded-full ${i <= level ? (level >= 4 ? "bg-destructive" : "bg-primary") : "bg-muted"}`} />
    ))}
  </div>
);

const FlagChip = ({ flag }: { flag?: "watch" | "vet_soon" | "emergency" | null }) => {
  if (!flag) return null;
  if (flag === "emergency") {
    return (
      <Badge className="text-[10px] bg-destructive text-destructive-foreground border-0">
        Emergency
      </Badge>
    );
  }
  if (flag === "vet_soon") {
    return (
      <Badge className="text-[10px] bg-amber-500/15 text-amber-700 dark:text-amber-300 border-0">
        See vet soon
      </Badge>
    );
  }
  return (
    <Badge className="text-[10px] bg-muted text-muted-foreground border-0">Watch</Badge>
  );
};

/* ============== NUTRITION ============== */
const NutritionTab = ({ petId }: { petId: string }) => {
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ["nutrition", petId],
    queryFn: async () => {
      const { data, error } = await supabase.from("nutrition_logs").select("*").eq("pet_id", petId).order("fed_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="space-y-3">
      <AddButton label="Log meal" onClick={() => setOpen(true)} />
      {isLoading ? <SkeletonList /> : !data?.length ? <EmptyState text="No meals logged" /> : data.map((n) => (
        <Card key={n.id} className="rounded-2xl border-hairline bg-card shadow-none p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="font-medium">{n.food}</div>
              <div className="text-xs text-muted-foreground mt-1">
                {n.portion && <>{n.portion} · </>}{format(new Date(n.fed_at), "d MMM, h:mm a")}
              </div>
            </div>
            <DeleteBtn table="nutrition_logs" id={n.id} invalidate={["nutrition", petId]} />
          </div>
        </Card>
      ))}
      <NutritionDialog open={open} onOpenChange={setOpen} petId={petId} />
    </div>
  );
};

const NutritionDialog = ({ open, onOpenChange, petId }: { open: boolean; onOpenChange: (b: boolean) => void; petId: string }) => {
  const qc = useQueryClient();
  const [form, setForm] = useState({ food: "", portion: "", notes: "" });
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.food.trim()) return toast.error("Food required");
    setSaving(true);
    const { error } = await supabase.from("nutrition_logs").insert({
      pet_id: petId,
      food: form.food.trim(),
      portion: form.portion.trim() || null,
      notes: form.notes.trim() || null,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Meal logged");
    qc.invalidateQueries({ queryKey: ["nutrition", petId] });
    onOpenChange(false);
    setForm({ food: "", portion: "", notes: "" });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl">
        <DialogHeader><DialogTitle className="font-display">Log meal</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <FormField label="Food" value={form.food} onChange={(v) => setForm({ ...form, food: v })} placeholder="Royal Canin, chicken & rice…" />
          <FormField label="Portion" value={form.portion} onChange={(v) => setForm({ ...form, portion: v })} placeholder="1 cup, 200g…" />
          <Button type="submit" disabled={saving} size="lg" className="w-full rounded-xl mt-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

/* ============== VET SHARE (QR + 8-CHAR CODE) ============== */
const VetShareButton = ({ petId, petName }: { petId: string; petName: string }) => {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="rounded-xl border-hairline gap-1.5 shrink-0">
          <QrCode className="h-3.5 w-3.5" /> Share
        </Button>
      </DialogTrigger>
      <DialogContent className="rounded-2xl">
        <DialogHeader><DialogTitle className="font-display">Share vault with vet</DialogTitle></DialogHeader>
        <VetShareBody petId={petId} petName={petName} />
      </DialogContent>
    </Dialog>
  );
};

const VetShareBody = ({ petId, petName }: { petId: string; petName: string }) => {
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const { data: grants, refetch } = useQuery({
    queryKey: ["grants", petId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vet_access_grants")
        .select("*")
        .eq("pet_id", petId)
        .eq("revoked", false)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const active = grants?.[0];
  const shareUrl = useMemo(() => active ? `${window.location.origin}/v/${active.code}` : "", [active]);

  const create = async () => {
    setCreating(true);
    const { data, error } = await supabase.functions.invoke("vet-grant-create", {
      body: { petId },
    });
    setCreating(false);
    if (error || (data as any)?.error) {
      return toast.error((data as any)?.error || error?.message || "Could not create link");
    }
    toast.success("Share link created — valid 24h");
    refetch();
  };

  const revoke = async () => {
    if (!active) return;
    const { error } = await supabase.from("vet_access_grants").update({ revoked: true }).eq("id", active.id);
    if (error) return toast.error(error.message);
    toast.success("Access revoked");
    refetch();
  };

  if (!active) {
    return (
      <div className="space-y-4 pt-2">
        <p className="text-sm text-muted-foreground">
          Generate a one-time code so a vet can view {petName}'s vault for 24 hours. You can revoke access any time.
        </p>
        <Button onClick={create} disabled={creating} size="lg" className="w-full rounded-xl">
          {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Share2 className="h-4 w-4 mr-2" /> Generate share code</>}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 pt-2">
      <div className="bg-card border border-hairline rounded-2xl p-5 flex flex-col items-center">
        <QRCodeSVG value={shareUrl} size={180} bgColor="transparent" fgColor="hsl(var(--foreground))" />
        <div className="font-display text-3xl tracking-[0.3em] mt-4">{active.code}</div>
        <div className="text-xs text-muted-foreground mt-1">
          Expires {format(new Date(active.expires_at), "d MMM, h:mm a")}
        </div>
      </div>
      <Button
        variant="outline"
        className="w-full rounded-xl border-hairline gap-2"
        onClick={() => { navigator.clipboard.writeText(shareUrl); toast.success("Link copied"); }}
      >
        <Copy className="h-4 w-4" /> Copy share link
      </Button>
      <Button variant="ghost" onClick={revoke} className="w-full text-destructive hover:text-destructive">
        Revoke access
      </Button>
    </div>
  );
};

/* ============== SHARED ============== */
const AddButton = ({ label, onClick }: { label: string; onClick: () => void }) => (
  <Button onClick={onClick} variant="outline" className="w-full rounded-xl border-dashed border-hairline h-12 text-muted-foreground hover:text-foreground gap-2">
    <Plus className="h-4 w-4" /> {label}
  </Button>
);

const EmptyState = ({ text }: { text: string }) => (
  <Card className="rounded-2xl border-hairline bg-card shadow-none p-8 text-center text-sm text-muted-foreground">
    {text}
  </Card>
);

const SkeletonList = () => (
  <>{[1, 2].map((i) => <Card key={i} className="rounded-2xl border-hairline bg-card shadow-none p-4 h-20 animate-pulse" />)}</>
);

const FormField = ({ label, value, onChange, type = "text", placeholder }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string;
}) => (
  <div className="space-y-1.5">
    <Label className="text-xs uppercase tracking-wide text-muted-foreground font-medium">{label}</Label>
    <Input value={value} onChange={(e) => onChange(e.target.value)} type={type} placeholder={placeholder} className="h-11 rounded-xl border-hairline" />
  </div>
);

const DeleteBtn = ({ table, id, invalidate }: { table: "vaccinations" | "health_records" | "symptom_logs" | "nutrition_logs"; id: string; invalidate: any[] }) => {
  const qc = useQueryClient();
  const onDelete = async () => {
    const { error } = await supabase.from(table).delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: invalidate });
  };
  return (
    <button onClick={onDelete} className="text-muted-foreground hover:text-destructive shrink-0 p-1">
      <Trash2 className="h-4 w-4" />
    </button>
  );
};

/* ============== CONSULTS ============== */
const STATUS_LABEL: Record<string, string> = {
  awaiting_vet: "Awaiting vet",
  assigned: "Assigned",
  in_progress: "In progress",
  completed: "Completed",
  cancelled: "Cancelled",
};
const ConsultsList = ({ petId }: { petId: string }) => {
  const nav = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ["consults", petId],
    queryFn: async () => {
      const { data, error } = await supabase.from("vet_consults")
        .select("id, severity, status, ai_summary, created_at")
        .eq("pet_id", petId)
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data;
    },
  });
  if (isLoading) return null;
  if (!data?.length) return null;
  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-display text-lg">Recent vet consults</h2>
      </div>
      <div className="space-y-2">
        {data.map((c) => (
          <button
            key={c.id}
            onClick={() => nav(`/vet/consult/${c.id}`)}
            className="w-full text-left rounded-2xl border border-hairline bg-card p-4 hover:bg-muted/30 transition-colors"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-[10px] capitalize">{c.severity}</Badge>
                  <span className="text-xs text-muted-foreground">{format(new Date(c.created_at), "d MMM, h:mm a")}</span>
                </div>
                {c.ai_summary && <p className="text-sm mt-1.5 line-clamp-2 text-ink-soft">{c.ai_summary}</p>}
              </div>
              <Badge variant="outline" className="shrink-0 text-[10px] border-hairline">{STATUS_LABEL[c.status] ?? c.status}</Badge>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default Health;
