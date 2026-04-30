import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

type Mode = "chat" | "video" | "in_clinic";

type Props = {
  vetId: string;
  mode: Mode;
  /** ISO date YYYY-MM-DD; defaults to today */
  date?: string;
  onChange: (iso: string | null) => void;
  /** Slot length in minutes */
  slotMinutes?: number;
};

/** Reads vet_availability + existing appointments and renders selectable time chips. */
export function AvailabilityPicker({ vetId, mode, date, onChange, slotMinutes = 30 }: Props) {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [day, setDay] = useState(date ?? today);
  const [picked, setPicked] = useState<string | null>(null);

  useEffect(() => { setPicked(null); onChange(null); /* eslint-disable-next-line */ }, [day, vetId, mode]);

  const weekday = new Date(day + "T00:00:00").getDay(); // 0..6

  const { data: windows = [] } = useQuery({
    queryKey: ["vet-availability", vetId, weekday, mode],
    enabled: !!vetId,
    queryFn: async () => {
      const { data } = await supabase
        .from("vet_availability" as any)
        .select("start_time, end_time, mode")
        .eq("vet_id", vetId)
        .eq("weekday", weekday)
        .eq("mode", mode);
      return (data ?? []) as Array<{ start_time: string; end_time: string }>;
    },
  });

  const { data: booked = [] } = useQuery({
    queryKey: ["vet-booked", vetId, day],
    enabled: !!vetId,
    queryFn: async () => {
      const start = new Date(day + "T00:00:00").toISOString();
      const end = new Date(day + "T23:59:59").toISOString();
      const { data } = await supabase
        .from("appointments" as any)
        .select("scheduled_at, status")
        .eq("vet_id", vetId)
        .gte("scheduled_at", start)
        .lte("scheduled_at", end)
        .not("status", "in", "(cancelled,no_show)");
      return ((data ?? []) as any[]).map((r) => new Date(r.scheduled_at).getTime());
    },
  });

  const slots = useMemo(() => {
    const out: { iso: string; label: string }[] = [];
    const now = Date.now();
    for (const w of windows) {
      const [sh, sm] = w.start_time.split(":").map(Number);
      const [eh, em] = w.end_time.split(":").map(Number);
      const startMin = sh * 60 + sm;
      const endMin = eh * 60 + em;
      for (let m = startMin; m + slotMinutes <= endMin; m += slotMinutes) {
        const d = new Date(day + "T00:00:00");
        d.setMinutes(m);
        const t = d.getTime();
        if (t < now) continue;
        if (booked.some((b) => Math.abs(b - t) < slotMinutes * 60 * 1000)) continue;
        out.push({
          iso: d.toISOString(),
          label: d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
        });
      }
    }
    return out;
  }, [windows, booked, day, slotMinutes]);

  const next7 = useMemo(() => {
    const arr: { value: string; label: string }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      arr.push({
        value: d.toISOString().slice(0, 10),
        label: d.toLocaleDateString([], { weekday: "short", day: "numeric" }),
      });
    }
    return arr;
  }, []);

  return (
    <div className="space-y-3">
      <div className="flex gap-2 overflow-x-auto -mx-1 px-1 pb-1">
        {next7.map((d) => (
          <button
            key={d.value}
            onClick={() => setDay(d.value)}
            className={`shrink-0 rounded-2xl px-3 py-2 text-xs border ${
              day === d.value ? "bg-primary text-primary-foreground border-primary" : "border-hairline"
            }`}
          >
            {d.label}
          </button>
        ))}
      </div>
      {windows.length === 0 ? (
        <div className="text-xs text-muted-foreground">No hours configured for this day.</div>
      ) : slots.length === 0 ? (
        <div className="text-xs text-muted-foreground">All slots booked — try another day.</div>
      ) : (
        <div className="grid grid-cols-4 gap-2">
          {slots.map((s) => (
            <button
              key={s.iso}
              onClick={() => { setPicked(s.iso); onChange(s.iso); }}
              className={`rounded-xl px-2 py-2 text-xs border ${
                picked === s.iso ? "bg-primary text-primary-foreground border-primary" : "border-hairline"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}