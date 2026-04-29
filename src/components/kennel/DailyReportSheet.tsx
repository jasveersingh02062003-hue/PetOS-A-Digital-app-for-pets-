import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, Smile, Meh, Heart } from "lucide-react";
import { toast } from "sonner";

export type DailyReportTarget = {
  bookingId: string;
  providerId: string;
  customerLabel?: string;
};

const todayISO = () => new Date().toISOString().slice(0, 10);

/**
 * Persists one row per (booking, day) into kennel_daily_reports.
 * If a report already exists for today, the form is pre-filled and the
 * submit becomes an update.
 */
export function DailyReportSheet({
  target,
  open,
  onOpenChange,
}: {
  target: DailyReportTarget | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [meals, setMeals] = useState(0);
  const [walks, setWalks] = useState(0);
  const [potty, setPotty] = useState(0);
  const [mood, setMood] = useState<"great" | "good" | "off">("good");
  const [notes, setNotes] = useState("");
  const [incidents, setIncidents] = useState("");

  const existing = useQuery({
    queryKey: ["kdr", target?.bookingId, todayISO()],
    enabled: !!target?.bookingId && open,
    queryFn: async () => {
      const { data } = await supabase
        .from("kennel_daily_reports")
        .select("*")
        .eq("booking_id", target!.bookingId)
        .eq("report_date", todayISO())
        .maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    const e: any = existing.data;
    if (e) {
      setMeals(e.meals ?? 0);
      setWalks(e.walks ?? 0);
      setPotty(e.potty ?? 0);
      setMood((e.mood as any) ?? "good");
      setNotes(e.notes ?? "");
      setIncidents(e.incidents ?? "");
    } else if (open) {
      setMeals(0); setWalks(0); setPotty(0);
      setMood("good"); setNotes(""); setIncidents("");
    }
  }, [existing.data, open]);

  const save = useMutation({
    mutationFn: async () => {
      if (!target || !user) throw new Error("Missing context");
      const payload = {
        booking_id: target.bookingId,
        provider_id: target.providerId,
        author_id: user.id,
        report_date: todayISO(),
        meals, walks, potty, mood,
        notes: notes.trim() || null,
        incidents: incidents.trim() || null,
      };
      const e: any = existing.data;
      if (e?.id) {
        const { error } = await supabase
          .from("kennel_daily_reports")
          .update(payload)
          .eq("id", e.id);
        if (error) throw error;
        return { updated: true };
      } else {
        const { error } = await supabase
          .from("kennel_daily_reports")
          .insert(payload);
        if (error) throw error;
        return { updated: false };
      }
    },
    onSuccess: (r) => {
      toast.success(r.updated ? "Report updated" : "Report sent — customer notified");
      qc.invalidateQueries({ queryKey: ["kdr-today-count"] });
      qc.invalidateQueries({ queryKey: ["kdr", target?.bookingId, todayISO()] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not save report"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Daily report</DialogTitle>
          <DialogDescription>
            {target?.customerLabel ? `For ${target.customerLabel}` : "Today's check-in"}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-2">
          <Counter label="Meals" value={meals} onChange={setMeals} />
          <Counter label="Walks" value={walks} onChange={setWalks} />
          <Counter label="Potty" value={potty} onChange={setPotty} />
        </div>

        <div>
          <Label className="text-xs">Mood</Label>
          <div className="grid grid-cols-3 gap-2 mt-1">
            <MoodChip active={mood === "great"} onClick={() => setMood("great")} icon={Heart} label="Great" />
            <MoodChip active={mood === "good"} onClick={() => setMood("good")} icon={Smile} label="Good" />
            <MoodChip active={mood === "off"} onClick={() => setMood("off")} icon={Meh} label="Off" />
          </div>
        </div>

        <div>
          <Label htmlFor="kdr-notes" className="text-xs">Notes (sent to customer)</Label>
          <Textarea
            id="kdr-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Played fetch in the yard, ate full breakfast…"
            rows={3}
            className="rounded-xl mt-1"
          />
        </div>

        <div>
          <Label htmlFor="kdr-incidents" className="text-xs">Incidents (optional)</Label>
          <Textarea
            id="kdr-incidents"
            value={incidents}
            onChange={(e) => setIncidents(e.target.value)}
            placeholder="Limping after walk — to monitor."
            rows={2}
            className="rounded-xl mt-1"
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={save.isPending}>
            Cancel
          </Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending} className="gap-1.5">
            {save.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {existing.data ? "Update report" : "Send report"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const Counter = ({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) => (
  <div className="rounded-xl border border-hairline p-2 text-center">
    <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">{label}</div>
    <div className="flex items-center justify-center gap-1 mt-1">
      <button
        type="button"
        onClick={() => onChange(Math.max(0, value - 1))}
        className="h-7 w-7 rounded-full bg-muted text-sm"
        aria-label={`Decrease ${label}`}
      >−</button>
      <Input
        value={value}
        onChange={(e) => onChange(Math.max(0, parseInt(e.target.value || "0", 10) || 0))}
        inputMode="numeric"
        className="h-7 w-10 text-center px-1 text-sm rounded-md"
      />
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        className="h-7 w-7 rounded-full bg-muted text-sm"
        aria-label={`Increase ${label}`}
      >+</button>
    </div>
  </div>
);

const MoodChip = ({ active, onClick, icon: Icon, label }: any) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={active}
    className={`h-10 rounded-xl border text-xs font-medium inline-flex items-center justify-center gap-1.5 transition ${
      active
        ? "bg-primary text-primary-foreground border-primary"
        : "bg-card text-muted-foreground border-hairline hover:text-foreground"
    }`}
  >
    <Icon className="h-3.5 w-3.5" /> {label}
  </button>
);