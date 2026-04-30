import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, ReferenceLine } from "recharts";
import { format } from "date-fns";
import { TrendingUp, Target } from "lucide-react";
import { useUnits } from "@/hooks/useUnits";

export const WeightChart = ({ petId }: { petId: string }) => {
  const { weightUnit, kgToDisplay, formatWeight } = useUnits();
  const { data: pet } = useQuery({
    queryKey: ["pet-target-weight", petId],
    queryFn: async () => {
      const { data } = await supabase
        .from("pets")
        .select("target_weight_kg")
        .eq("id", petId)
        .maybeSingle();
      return data as { target_weight_kg: number | null } | null;
    },
  });
  const target = pet?.target_weight_kg ? Number(pet.target_weight_kg) : null;
  const targetDisp = target != null ? kgToDisplay(target) : null;

  const { data } = useQuery({
    queryKey: ["weight-trend", petId, weightUnit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vital_logs")
        .select("recorded_at, weight_kg")
        .eq("pet_id", petId)
        .not("weight_kg", "is", null)
        .order("recorded_at", { ascending: true })
        .limit(30);
      if (error) throw error;
      return (data ?? []).map((d) => ({
        date: format(new Date(d.recorded_at), "d MMM"),
        weight: Number(kgToDisplay(Number(d.weight_kg)) ?? 0),
      }));
    },
  });

  if (!data || data.length < 2) return null;

  const latest = data[data.length - 1].weight;
  const delta = targetDisp != null ? latest - targetDisp : null;
  const deltaLabel =
    delta == null
      ? null
      : Math.abs(delta) < 0.05
      ? "On target"
      : `${delta > 0 ? "+" : ""}${delta.toFixed(1)} ${weightUnit} vs target`;
  const deltaTone =
    delta == null
      ? ""
      : Math.abs(delta) < 0.3
      ? "text-leaf"
      : Math.abs(delta) < 1
      ? "text-amber-600 dark:text-amber-400"
      : "text-destructive";

  return (
    <Card className="rounded-2xl border-hairline bg-card shadow-none p-4 mb-3">
      <div className="flex items-center justify-between mb-3 gap-2">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Weight trend</span>
        </div>
        {deltaLabel && (
          <span className={`text-xs font-medium ${deltaTone} flex items-center gap-1`}>
            <Target className="h-3 w-3" /> {deltaLabel}
          </span>
        )}
      </div>
      <ResponsiveContainer width="100%" height={140}>
        <LineChart data={data} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
          <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
          <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" domain={["auto", "auto"]} />
          <Tooltip
            contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 }}
            formatter={(v: any) => [`${v} ${weightUnit}`, "Weight"]}
          />
          {targetDisp != null && (
            <ReferenceLine
              y={targetDisp}
              stroke="hsl(var(--leaf, var(--primary)))"
              strokeDasharray="4 4"
              strokeWidth={1.5}
              label={{ value: `Target ${formatWeight(target, { precision: 1 })}`, fontSize: 10, fill: "hsl(var(--muted-foreground))", position: "insideTopRight" }}
            />
          )}
          <Line type="monotone" dataKey="weight" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
      {!target && (
        <p className="text-[10px] text-muted-foreground mt-2">
          Set a target weight in pet settings to see goal tracking.
        </p>
      )}
    </Card>
  );
};
