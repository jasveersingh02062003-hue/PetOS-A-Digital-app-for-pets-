import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";
import { format } from "date-fns";
import { TrendingUp } from "lucide-react";

export const WeightChart = ({ petId }: { petId: string }) => {
  const { data } = useQuery({
    queryKey: ["weight-trend", petId],
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
        weight: Number(d.weight_kg),
      }));
    },
  });

  if (!data || data.length < 2) return null;

  return (
    <Card className="rounded-2xl border-hairline bg-card shadow-none p-4 mb-3">
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium">Weight trend</span>
      </div>
      <ResponsiveContainer width="100%" height={140}>
        <LineChart data={data} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
          <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
          <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" domain={["auto", "auto"]} />
          <Tooltip
            contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 }}
            formatter={(v: any) => [`${v} kg`, "Weight"]}
          />
          <Line type="monotone" dataKey="weight" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </Card>
  );
};
