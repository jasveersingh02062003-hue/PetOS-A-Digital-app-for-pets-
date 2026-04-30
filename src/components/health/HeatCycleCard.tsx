import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Heart, Plus, Loader2, Trash2, Calendar } from "lucide-react";
import { format, differenceInDays, addDays } from "date-fns";
import { toast } from "sonner";

/**
 * HeatCycleCard — only shown for unspayed female pets.
 * Predicts the next cycle ~6 months after the most recent start.
 */
export function HeatCycleCard({ petId }: { petId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["heat-cycles", petId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("heat_cycle_logs" as any)
        .select("*")
        .eq("pet_id", petId)
        .order("start_on", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const last = logs[0];
  const predicted = last ? addDays(new Date(last.start_on), 180) : null;
  const daysToNext = predicted ? differenceInDays(predicted, new Date()) : null;

  const remove = async (id: string) => {
    const { error } = await supabase.from("heat_cycle_logs" as any).delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Entry removed");
    qc.invalidateQueries({ queryKey: ["heat-cycles", petId] });
  };

  return (
    <Card className="rounded-2xl border-hairline p-4 mb-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Heart className="h-4 w-4 text-primary" />
          <span className="font-display text-base">Heat cycle</span>
        </div>
        <Button size="sm" variant="outline" className="rounded-full gap-1" onClick={() => setOpen(true)}>
          <Plus className="h-3.5 w-3.5" /> Log
        </Button>
      </div>

      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      ) : logs.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">
          Log heat cycles to spot patterns and predict the next one.
        </p>
      ) : (
        <>
          {predicted && (
            <div className="rounded-xl bg-primary-soft/60 p-3">
              <div className="text-[10px] uppercase tracking-wide text-primary">Predicted next cycle</div>
              <div className="text-sm font-medium">
                ~{format(predicted, "d MMM yyyy")}{" "}
                <span className="text-muted-foreground text-xs">
                  ({daysToNext! >= 0 ? `in ${daysToNext} days` : `${Math.abs(daysToNext!)} days ago`})
                </span>
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">
                Estimate based on a ~6-month cycle. Actual timing varies by breed.
              </div>
            </div>
          )}
          <div className="space-y-1.5">
            {logs.map((l) => (
              <div key={l.id} className="flex items-center justify-between rounded-lg border border-hairline p-2 text-sm">
                <div className="min-w-0">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    {format(new Date(l.start_on), "d MMM yyyy")}
                    {l.end_on && <> – {format(new Date(l.end_on), "d MMM")}</>}
                  </div>
                  {l.notes && <p className="text-xs text-ink-soft mt-0.5">{l.notes}</p>}
                </div>
                <div className="flex items-center gap-2">
                  {l.intensity && (
                    <span className="text-[10px] text-muted-foreground">Intensity {l.intensity}/5</span>
                  )}
                  <button onClick={() => remove(l.id)} className="text-muted-foreground hover:text-destructive p-1">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <HeatLogDialog open={open} onOpenChange={setOpen} petId={petId} />
    </Card>
  );
}

function HeatLogDialog({ open, onOpenChange, petId }: { open: boolean; onOpenChange: (b: boolean) => void; petId: string }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    start_on: new Date().toISOString().slice(0, 10),
    end_on: "",
    intensity: 3,
    notes: "",
  });
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const { error } = await supabase.from("heat_cycle_logs" as any).insert({
      pet_id: petId,
      start_on: form.start_on,
      end_on: form.end_on || null,
      intensity: form.intensity,
      notes: form.notes.trim() || null,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Heat cycle logged");
    qc.invalidateQueries({ queryKey: ["heat-cycles", petId] });
    onOpenChange(false);
    setForm({ start_on: new Date().toISOString().slice(0, 10), end_on: "", intensity: 3, notes: "" });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl">
        <DialogHeader><DialogTitle className="font-display">Log heat cycle</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground font-medium">Start date</Label>
              <Input type="date" value={form.start_on} onChange={(e) => setForm({ ...form, start_on: e.target.value })} className="h-11 rounded-xl border-hairline" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground font-medium">End date</Label>
              <Input type="date" value={form.end_on} onChange={(e) => setForm({ ...form, end_on: e.target.value })} className="h-11 rounded-xl border-hairline" />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground font-medium">Intensity ({form.intensity}/5)</Label>
            <Slider value={[form.intensity]} onValueChange={(v) => setForm({ ...form, intensity: v[0] })} min={1} max={5} step={1} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground font-medium">Notes</Label>
            <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="rounded-xl border-hairline min-h-[60px]" />
          </div>
          <Button type="submit" disabled={saving} size="lg" className="w-full rounded-xl">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}