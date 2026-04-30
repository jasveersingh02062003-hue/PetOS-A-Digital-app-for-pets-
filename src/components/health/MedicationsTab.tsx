import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Pill, Check, X, Clock } from "lucide-react";
import { format, parseISO } from "date-fns";

const SCHEDULE_LABEL: Record<string, string> = {
  once_daily: "Once a day",
  twice_daily: "Twice a day",
  thrice_daily: "Three times a day",
  every_n_hours: "Every N hours",
  as_needed: "As needed",
};
const DEFAULT_TIMES: Record<string, string[]> = {
  once_daily: ["09:00"],
  twice_daily: ["09:00", "21:00"],
  thrice_daily: ["08:00", "14:00", "20:00"],
};

export const MedicationsTab = ({ petId }: { petId: string }) => {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ["meds", petId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("medication_logs")
        .select("*")
        .eq("pet_id", petId)
        .order("active", { ascending: false })
        .order("start_on", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const toggleActive = async (id: string, active: boolean) => {
    const { error } = await supabase.from("medication_logs").update({ active }).eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["meds", petId] });
  };
  const del = async (id: string) => {
    const { error } = await supabase.from("medication_logs").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["meds", petId] });
  };

  return (
    <div className="space-y-3">
      <Button onClick={() => setOpen(true)} variant="outline" className="w-full rounded-xl border-dashed border-hairline h-12 text-muted-foreground hover:text-foreground gap-2">
        <Plus className="h-4 w-4" /> Add medication
      </Button>
      {isLoading ? (
        <Card className="rounded-2xl border-hairline bg-card shadow-none p-4 h-20 animate-pulse" />
      ) : !data?.length ? (
        <Card className="rounded-2xl border-hairline bg-card shadow-none p-8 text-center text-sm text-muted-foreground">
          No medications recorded
        </Card>
      ) : (
        data.map((m: any) => (
          <Card key={m.id} className="rounded-2xl border-hairline bg-card shadow-none p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <Pill className="h-4 w-4 text-primary" />
                  <span className="font-medium">{m.name}</span>
                  {m.active && <Badge variant="secondary" className="bg-primary-soft text-primary border-0 text-[10px]">Active</Badge>}
                </div>
                <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-3">
                  {m.dose && <span>Dose: {m.dose}</span>}
                  {m.route && <span>{m.route}</span>}
                  {m.schedule_kind ? (
                    <span>{SCHEDULE_LABEL[m.schedule_kind] ?? m.schedule_kind}</span>
                  ) : m.frequency ? <span>{m.frequency}</span> : null}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {format(new Date(m.start_on), "d MMM yyyy")}
                  {m.end_on && <> → {format(new Date(m.end_on), "d MMM yyyy")}</>}
                </div>
                {m.reason && <p className="text-sm text-ink-soft mt-2">For: {m.reason}</p>}
                {m.prescribing_vet && <p className="text-xs text-muted-foreground mt-1">Rx: {m.prescribing_vet}</p>}
                {m.active && m.schedule_kind && m.schedule_kind !== "as_needed" && (
                  <DoseTicker medicationId={m.id} petId={petId} />
                )}
                <div className="flex items-center gap-2 mt-3 pt-2 border-t border-hairline">
                  <Switch checked={m.active} onCheckedChange={(v) => toggleActive(m.id, v)} />
                  <span className="text-xs text-muted-foreground">{m.active ? "Currently taking" : "Discontinued"}</span>
                </div>
              </div>
              <button onClick={() => del(m.id)} className="text-muted-foreground hover:text-destructive shrink-0 p-1">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </Card>
        ))
      )}
      <MedDialog open={open} onOpenChange={setOpen} petId={petId} />
    </div>
  );
};

const DoseTicker = ({ medicationId, petId }: { medicationId: string; petId: string }) => {
  const qc = useQueryClient();
  const startIso = useMemo(() => { const s = new Date(); s.setHours(0, 0, 0, 0); return s.toISOString(); }, []);
  const endIso = useMemo(() => { const e = new Date(); e.setHours(23, 59, 59, 999); return e.toISOString(); }, []);

  const { data, refetch } = useQuery({
    queryKey: ["med-doses-today", medicationId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("medication_doses")
        .select("id, scheduled_at, taken_at, skipped")
        .eq("medication_id", medicationId)
        .gte("scheduled_at", startIso)
        .lte("scheduled_at", endIso)
        .order("scheduled_at", { ascending: true });
      return data ?? [];
    },
  });

  const ensureSpawned = async () => {
    await (supabase as any).rpc("spawn_medication_doses", { _med_id: medicationId, _days: 7 });
    refetch();
  };

  const mark = async (id: string, action: "take" | "skip" | "undo") => {
    const patch = action === "take" ? { taken_at: new Date().toISOString(), skipped: false }
      : action === "skip" ? { taken_at: null, skipped: true }
      : { taken_at: null, skipped: false };
    const { error } = await (supabase as any).from("medication_doses").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["med-doses-today", medicationId] });
    qc.invalidateQueries({ queryKey: ["daily-care", petId] });
  };

  if (data && data.length === 0) {
    return (
      <button onClick={ensureSpawned} className="mt-2 text-[11px] text-primary inline-flex items-center gap-1">
        <Clock className="h-3 w-3" /> Generate today's doses
      </button>
    );
  }

  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {data?.map((d: any) => {
        const t = format(parseISO(d.scheduled_at), "h:mma").toLowerCase();
        const taken = !!d.taken_at;
        const skipped = d.skipped;
        return (
          <div key={d.id} className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] ${taken ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300" : skipped ? "bg-muted border-hairline text-muted-foreground line-through" : "bg-card border-hairline"}`}>
            <span>{t}</span>
            {taken || skipped ? (
              <button onClick={() => mark(d.id, "undo")} className="ml-0.5 opacity-70 hover:opacity-100" aria-label="Undo"><X className="h-3 w-3" /></button>
            ) : (
              <>
                <button onClick={() => mark(d.id, "take")} className="ml-0.5 text-emerald-600 hover:text-emerald-700" aria-label="Mark taken"><Check className="h-3 w-3" /></button>
                <button onClick={() => mark(d.id, "skip")} className="text-muted-foreground hover:text-foreground" aria-label="Skip"><X className="h-3 w-3" /></button>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
};

type ScheduleKind = "once_daily" | "twice_daily" | "thrice_daily" | "every_n_hours" | "as_needed";

const MedDialog = ({ open, onOpenChange, petId }: { open: boolean; onOpenChange: (b: boolean) => void; petId: string }) => {
  const qc = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    name: "", dose: "", route: "oral", reason: "", prescribing_vet: "",
    start_on: today, end_on: "",
    schedule_kind: "twice_daily" as ScheduleKind,
    times_of_day: ["09:00", "21:00"] as string[],
    every_n_hours: 8,
  });
  const [saving, setSaving] = useState(false);

  const setSchedule = (kind: ScheduleKind) => {
    setForm((f) => ({ ...f, schedule_kind: kind, times_of_day: DEFAULT_TIMES[kind] ?? f.times_of_day }));
  };
  const setTime = (i: number, v: string) => {
    const next = [...form.times_of_day]; next[i] = v;
    setForm({ ...form, times_of_day: next });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.error("Medication name required");
    setSaving(true);
    const usesTimes = ["once_daily", "twice_daily", "thrice_daily"].includes(form.schedule_kind);
    const { data: row, error } = await supabase.from("medication_logs").insert({
      pet_id: petId,
      name: form.name.trim(),
      dose: form.dose.trim() || null,
      route: form.route.trim() || null,
      frequency: SCHEDULE_LABEL[form.schedule_kind],
      schedule_kind: form.schedule_kind,
      times_of_day: usesTimes ? form.times_of_day : null,
      every_n_hours: form.schedule_kind === "every_n_hours" ? form.every_n_hours : null,
      reason: form.reason.trim() || null,
      prescribing_vet: form.prescribing_vet.trim() || null,
      start_on: form.start_on,
      end_on: form.end_on || null,
      active: true,
    } as any).select("id").maybeSingle();
    setSaving(false);
    if (error) return toast.error(error.message);
    if (row?.id && form.schedule_kind !== "as_needed") {
      await (supabase as any).rpc("spawn_medication_doses", { _med_id: row.id, _days: 7 });
    }
    toast.success("Medication added");
    qc.invalidateQueries({ queryKey: ["meds", petId] });
    qc.invalidateQueries({ queryKey: ["daily-care", petId] });
    onOpenChange(false);
    setForm({ name: "", dose: "", route: "oral", reason: "", prescribing_vet: "", start_on: today, end_on: "", schedule_kind: "twice_daily", times_of_day: ["09:00","21:00"], every_n_hours: 8 });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="font-display">Add medication</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <Field label="Medication name" value={form.name} onChange={(v: string) => setForm({ ...form, name: v })} placeholder="Apoquel, Prednisone…" />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Dose" value={form.dose} onChange={(v: string) => setForm({ ...form, dose: v })} placeholder="5mg" />
            <Field label="Route" value={form.route} onChange={(v: string) => setForm({ ...form, route: v })} placeholder="oral / SC / IM" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground font-medium">Schedule</Label>
            <Select value={form.schedule_kind} onValueChange={(v) => setSchedule(v as ScheduleKind)}>
              <SelectTrigger className="h-11 rounded-xl border-hairline"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(SCHEDULE_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {["once_daily","twice_daily","thrice_daily"].includes(form.schedule_kind) && (
            <div className="grid grid-cols-3 gap-2">
              {form.times_of_day.map((t, i) => (
                <Field key={i} label={`Time ${i + 1}`} type="time" value={t} onChange={(v: string) => setTime(i, v)} />
              ))}
            </div>
          )}
          {form.schedule_kind === "every_n_hours" && (
            <Field label="Every N hours" type="number" value={String(form.every_n_hours)} onChange={(v: string) => setForm({ ...form, every_n_hours: Math.max(1, Math.min(24, Number(v) || 8)) })} />
          )}
          <Field label="Reason / condition" value={form.reason} onChange={(v: string) => setForm({ ...form, reason: v })} placeholder="Allergy, infection…" />
          <Field label="Prescribing vet" value={form.prescribing_vet} onChange={(v: string) => setForm({ ...form, prescribing_vet: v })} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Start date" type="date" value={form.start_on} onChange={(v: string) => setForm({ ...form, start_on: v })} />
            <Field label="End date" type="date" value={form.end_on} onChange={(v: string) => setForm({ ...form, end_on: v })} />
          </div>
          <Button type="submit" disabled={saving} size="lg" className="w-full rounded-xl mt-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

const Field = ({ label, value, onChange, type = "text", ...rest }: any) => (
  <div className="space-y-1.5">
    <Label className="text-xs uppercase tracking-wide text-muted-foreground font-medium">{label}</Label>
    <Input value={value} onChange={(e) => onChange(e.target.value)} type={type} className="h-11 rounded-xl border-hairline" {...rest} />
  </div>
);
