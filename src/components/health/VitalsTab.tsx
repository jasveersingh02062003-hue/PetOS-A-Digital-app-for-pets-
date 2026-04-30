import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Calendar } from "lucide-react";
import { format } from "date-fns";
import { WeightChart } from "./WeightChart";
import { useUnits } from "@/hooks/useUnits";

export const VitalsTab = ({ petId }: { petId: string }) => {
  const qc = useQueryClient();
  const { formatWeight, formatTemp, weightUnit, tempUnit, parseWeightToKg } = useUnits();
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ["vitals", petId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vital_logs")
        .select("*")
        .eq("pet_id", petId)
        .order("recorded_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  const del = async (id: string) => {
    const { error } = await supabase.from("vital_logs").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["vitals", petId] });
    qc.invalidateQueries({ queryKey: ["weight-trend", petId] });
  };

  return (
    <div className="space-y-3">
      <WeightChart petId={petId} />
      <Button onClick={() => setOpen(true)} variant="outline" className="w-full rounded-xl border-dashed border-hairline h-12 text-muted-foreground hover:text-foreground gap-2">
        <Plus className="h-4 w-4" /> Log vitals
      </Button>
      {isLoading ? (
        <Card className="rounded-2xl border-hairline bg-card shadow-none p-4 h-20 animate-pulse" />
      ) : !data?.length ? (
        <Card className="rounded-2xl border-hairline bg-card shadow-none p-8 text-center text-sm text-muted-foreground">
          No vitals recorded yet
        </Card>
      ) : (
        data.map((v) => (
          <Card key={v.id} className="rounded-2xl border-hairline bg-card shadow-none p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="text-xs text-muted-foreground flex items-center gap-1 mb-2">
                  <Calendar className="h-3 w-3" /> {format(new Date(v.recorded_at), "d MMM, h:mm a")}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                  {v.weight_kg != null && <span><b>{formatWeight(Number(v.weight_kg), { unit: false })}</b> {weightUnit}</span>}
                  {v.temperature_c != null && <span><b>{formatTemp(Number(v.temperature_c), { unit: false })}</b> °{tempUnit.toUpperCase()}</span>}
                  {v.heart_rate_bpm != null && <span>HR <b>{v.heart_rate_bpm}</b></span>}
                  {v.respiratory_rate_rpm != null && <span>RR <b>{v.respiratory_rate_rpm}</b></span>}
                  {v.body_condition != null && <span>BCS <b>{v.body_condition}</b>/9</span>}
                  {v.gum_colour && <span>Gums: {v.gum_colour}</span>}
                  {v.hydration && <span>Hydration: {v.hydration}</span>}
                </div>
                {v.notes && <p className="text-sm text-ink-soft mt-2">{v.notes}</p>}
              </div>
              <button onClick={() => del(v.id)} className="text-muted-foreground hover:text-destructive shrink-0 p-1">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </Card>
        ))
      )}
      <VitalsDialog open={open} onOpenChange={setOpen} petId={petId} weightUnit={weightUnit} tempUnit={tempUnit} parseWeightToKg={parseWeightToKg} />
    </div>
  );
};

const VitalsDialog = ({ open, onOpenChange, petId, weightUnit, tempUnit, parseWeightToKg }: {
  open: boolean; onOpenChange: (b: boolean) => void; petId: string;
  weightUnit: "kg" | "lb"; tempUnit: "c" | "f"; parseWeightToKg: (v: string | number) => number | null;
}) => {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    weight_kg: "", temperature_c: "", heart_rate_bpm: "", respiratory_rate_rpm: "",
    body_condition: "", gum_colour: "", hydration: "", notes: "",
  });
  const [saving, setSaving] = useState(false);

  const num = (s: string) => (s.trim() === "" ? null : Number(s));
  // Convert the user's input unit to canonical storage unit (kg / °C)
  const tempToC = (s: string): number | null => {
    const n = num(s);
    if (n == null) return null;
    return tempUnit === "f" ? ((n - 32) * 5) / 9 : n;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const { error } = await supabase.from("vital_logs").insert({
      pet_id: petId,
      weight_kg: form.weight_kg.trim() === "" ? null : parseWeightToKg(form.weight_kg),
      temperature_c: tempToC(form.temperature_c),
      heart_rate_bpm: num(form.heart_rate_bpm) as any,
      respiratory_rate_rpm: num(form.respiratory_rate_rpm) as any,
      body_condition: num(form.body_condition) as any,
      gum_colour: form.gum_colour.trim() || null,
      hydration: form.hydration.trim() || null,
      notes: form.notes.trim() || null,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Vitals logged");
    qc.invalidateQueries({ queryKey: ["vitals", petId] });
    qc.invalidateQueries({ queryKey: ["weight-trend", petId] });
    onOpenChange(false);
    setForm({ weight_kg: "", temperature_c: "", heart_rate_bpm: "", respiratory_rate_rpm: "", body_condition: "", gum_colour: "", hydration: "", notes: "" });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="font-display">Log vitals</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label={`Weight (${weightUnit})`} value={form.weight_kg} onChange={(v) => setForm({ ...form, weight_kg: v })} type="number" step="0.1" />
            <Field label={`Temp (°${tempUnit.toUpperCase()})`} value={form.temperature_c} onChange={(v) => setForm({ ...form, temperature_c: v })} type="number" step="0.1" />
            <Field label="Heart rate (bpm)" value={form.heart_rate_bpm} onChange={(v) => setForm({ ...form, heart_rate_bpm: v })} type="number" />
            <Field label="Resp rate (rpm)" value={form.respiratory_rate_rpm} onChange={(v) => setForm({ ...form, respiratory_rate_rpm: v })} type="number" />
            <Field label="Body cond. (1–9)" value={form.body_condition} onChange={(v) => setForm({ ...form, body_condition: v })} type="number" min="1" max="9" />
            <Field label="Gum colour" value={form.gum_colour} onChange={(v) => setForm({ ...form, gum_colour: v })} placeholder="pink" />
          </div>
          <Field label="Hydration" value={form.hydration} onChange={(v) => setForm({ ...form, hydration: v })} placeholder="normal / mild / poor" />
          <Field label="Notes" value={form.notes} onChange={(v) => setForm({ ...form, notes: v })} />
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
