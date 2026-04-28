import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { ShieldCheck, Activity, Syringe, Flame } from "lucide-react";
import { differenceInCalendarDays } from "date-fns";

type Status = {
  pet_id: string;
  name: string;
  next_parasite_due: string | null;
  weight_kg: number | null;
  last_activity_on: string | null;
  vaccination_verified: boolean;
};

export const HealthStatusStrip = ({ petId }: { petId?: string }) => {
  const { data } = useQuery({
    queryKey: ["pet-health-status", petId ?? null],
    enabled: !!petId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pet_health_status" as any)
        .select("*")
        .eq("pet_id", petId!)
        .maybeSingle();
      if (error) throw error;
      return data as Status | null;
    },
  });

  if (!data) return null;

  const daysSinceActivity = data.last_activity_on
    ? differenceInCalendarDays(new Date(), new Date(data.last_activity_on))
    : null;
  const daysToParasite = data.next_parasite_due
    ? differenceInCalendarDays(new Date(data.next_parasite_due), new Date())
    : null;

  // Score: 100 base; -20 if vaccine not verified, -15 per overdue, -10 if no activity in 3+ days
  let score = 100;
  if (!data.vaccination_verified) score -= 20;
  if (daysToParasite != null && daysToParasite < 0) score -= 15;
  if (daysSinceActivity != null && daysSinceActivity > 2) score -= 10;
  score = Math.max(0, score);

  const dot = score >= 80 ? "bg-emerald-500" : score >= 60 ? "bg-amber-500" : "bg-rose-500";

  return (
    <Link
      to="/health"
      className="block rounded-2xl border border-hairline bg-card p-3 mb-3 hover:bg-muted/30 transition-colors"
    >
      <div className="flex items-center gap-3">
        <div className={`h-2.5 w-2.5 rounded-full ${dot}`} aria-hidden />
        <div className="text-sm font-medium">{data.name} · Health {score}</div>
        <div className="ml-auto flex items-center gap-2 text-[11px] text-muted-foreground">
          {data.vaccination_verified ? (
            <span className="inline-flex items-center gap-1"><ShieldCheck className="h-3 w-3 text-emerald-600" /> Vax</span>
          ) : (
            <span className="inline-flex items-center gap-1"><Syringe className="h-3 w-3 text-amber-600" /> Vax pending</span>
          )}
          {daysToParasite != null && (
            <span className="inline-flex items-center gap-1">
              <Flame className="h-3 w-3" />
              {daysToParasite < 0 ? `Parasite overdue` : `${daysToParasite}d to parasite`}
            </span>
          )}
          {daysSinceActivity != null && (
            <span className="inline-flex items-center gap-1">
              <Activity className="h-3 w-3" />
              {daysSinceActivity === 0 ? "active today" : `${daysSinceActivity}d ago`}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
};
