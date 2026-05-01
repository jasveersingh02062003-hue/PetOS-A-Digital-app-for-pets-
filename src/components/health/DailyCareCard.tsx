import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Syringe, Bug, Pill, Scale, CheckCircle2, CalendarClock } from "lucide-react";
import { differenceInCalendarDays, format } from "date-fns";
import { useNavigate } from "react-router-dom";

type IconKey = "syringe" | "bug" | "pill" | "scale";

type Item = {
  key: string;
  iconKey: IconKey;
  title: string;
  due: string; // human label
  tone: "due" | "soon" | "overdue";
  ctaLabel: string;
  ctaHref: string;
};

const ICONS: Record<IconKey, typeof Syringe> = {
  syringe: Syringe,
  bug: Bug,
  pill: Pill,
  scale: Scale,
};

const TONE: Record<Item["tone"], string> = {
  overdue: "text-emergency",
  due: "text-amber-600",
  soon: "text-muted-foreground",
};

export const DailyCareCard = ({ petId, petName }: { petId: string; petName: string }) => {
  const nav = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ["daily-care", petId],
    queryFn: async () => {
      const today = new Date();
      const horizon = new Date(today.getTime() + 14 * 86400_000).toISOString().slice(0, 10);

      const startOfDay = new Date(); startOfDay.setHours(0,0,0,0);
      const endOfDay = new Date(); endOfDay.setHours(23,59,59,999);

      const [vax, paras, doses, meds, vital] = await Promise.all([
        supabase.from("vaccinations")
          .select("id, vaccine_name, next_due_on")
          .eq("pet_id", petId)
          .not("next_due_on", "is", null)
          .lte("next_due_on", horizon)
          .order("next_due_on", { ascending: true })
          .limit(5),
        supabase.from("parasite_preventatives")
          .select("id, product_name, parasite_type, next_due_on")
          .eq("pet_id", petId)
          .not("next_due_on", "is", null)
          .lte("next_due_on", horizon)
          .order("next_due_on", { ascending: true })
          .limit(5),
        (supabase as any)
          .from("medication_doses")
          .select("id, scheduled_at, taken_at, skipped, medication_logs(name, dose)")
          .eq("pet_id", petId)
          .gte("scheduled_at", startOfDay.toISOString())
          .lte("scheduled_at", endOfDay.toISOString())
          .is("taken_at", null)
          .eq("skipped", false)
          .order("scheduled_at", { ascending: true })
          .limit(8),
        supabase.from("medication_logs")
          .select("id, name, dose, frequency, active, schedule_kind")
          .eq("pet_id", petId)
          .eq("active", true)
          .order("start_on", { ascending: false })
          .limit(5),
        supabase.from("vital_logs")
          .select("recorded_at, weight_kg")
          .eq("pet_id", petId)
          .not("weight_kg", "is", null)
          .order("recorded_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      const items: Item[] = [];

      vax.data?.forEach((v: any) => {
        const days = differenceInCalendarDays(new Date(v.next_due_on), today);
        items.push({
          key: `vax-${v.id}`,
          icon: Syringe,
          title: v.vaccine_name,
          due: days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? "due today" : `in ${days}d`,
          tone: days < 0 ? "overdue" : days <= 3 ? "due" : "soon",
          cta: { label: "Log", onClick: () => nav(`/health`) },
        });
      });

      paras.data?.forEach((p: any) => {
        const days = differenceInCalendarDays(new Date(p.next_due_on), today);
        items.push({
          key: `par-${p.id}`,
          icon: Bug,
          title: `${p.product_name} (${p.parasite_type})`,
          due: days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? "due today" : `in ${days}d`,
          tone: days < 0 ? "overdue" : days <= 3 ? "due" : "soon",
          cta: { label: "Log", onClick: () => nav(`/health`) },
        });
      });

      // Prefer today's open doses; fall back to active meds without a schedule.
      const dosed = new Set<string>();
      (doses as any)?.data?.forEach((d: any) => {
        const time = format(new Date(d.scheduled_at), "h:mma").toLowerCase();
        const name = d.medication_logs?.name ?? "Medication";
        const dose = d.medication_logs?.dose ? ` · ${d.medication_logs.dose}` : "";
        const isPast = new Date(d.scheduled_at).getTime() < Date.now();
        items.push({
          key: `dose-${d.id}`,
          icon: Pill,
          title: `${name}${dose}`,
          due: `${time}${isPast ? " · missed" : ""}`,
          tone: isPast ? "overdue" : "due",
          cta: { label: "Log", onClick: () => nav(`/health`) },
        });
        dosed.add(d.id);
      });
      meds.data?.forEach((m: any) => {
        if (m.schedule_kind && m.schedule_kind !== "as_needed") return; // covered by doses
        items.push({
          key: `med-${m.id}`,
          icon: Pill,
          title: m.name,
          due: [m.dose, m.frequency].filter(Boolean).join(" · ") || "active",
          tone: "soon",
          cta: { label: "View", onClick: () => nav(`/health`) },
        });
      });

      const lastWeight = vital.data?.recorded_at ? new Date(vital.data.recorded_at) : null;
      const weightDays = lastWeight ? differenceInCalendarDays(today, lastWeight) : null;
      if (weightDays === null || weightDays > 30) {
        items.push({
          key: "weight-check",
          icon: Scale,
          title: "Log a weight",
          due: lastWeight ? `last ${format(lastWeight, "d MMM")}` : "never logged",
          tone: "soon",
          cta: { label: "Log", onClick: () => nav(`/health`) },
        });
      }

      // overdue first, then due, then soon
      const order: Record<Item["tone"], number> = { overdue: 0, due: 1, soon: 2 };
      items.sort((a, b) => order[a.tone] - order[b.tone]);
      return items.slice(0, 6);
    },
    enabled: !!petId,
  });

  if (isLoading) {
    return <Card className="rounded-2xl border-hairline bg-card shadow-none p-4 mb-3 h-24 animate-pulse" />;
  }

  if (!data || data.length === 0) {
    return (
      <Card className="rounded-2xl border-hairline bg-card shadow-none p-4 mb-3">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-emerald-500/10 text-emerald-600 grid place-items-center">
            <CheckCircle2 className="h-4 w-4" />
          </div>
          <div>
            <div className="font-medium text-sm">All caught up for {petName}</div>
            <div className="text-xs text-muted-foreground">Nothing due in the next 2 weeks.</div>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl border-hairline bg-card shadow-none p-3 mb-3">
      <div className="flex items-center gap-2 px-1 mb-2">
        <CalendarClock className="h-4 w-4 text-primary" />
        <div className="text-xs uppercase tracking-wide text-muted-foreground font-medium">Care due</div>
      </div>
      <ul className="divide-y divide-hairline">
        {data.map((it) => {
          const Icon = it.icon;
          return (
            <li key={it.key} className="flex items-center gap-3 py-2 px-1">
              <div className="h-8 w-8 rounded-full bg-primary-soft text-primary grid place-items-center shrink-0">
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate">{it.title}</div>
                <div className={`text-[11px] ${TONE[it.tone]}`}>{it.due}</div>
              </div>
              <Button size="sm" variant="ghost" className="h-8 px-3 rounded-full" onClick={it.cta.onClick}>
                {it.cta.label}
              </Button>
            </li>
          );
        })}
      </ul>
    </Card>
  );
};
