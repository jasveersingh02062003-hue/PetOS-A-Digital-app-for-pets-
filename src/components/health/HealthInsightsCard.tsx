import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, RefreshCw, Loader2, AlertTriangle, Info, Activity } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";

type Insight = {
  kind: string;
  severity: "info" | "watch" | "action";
  title: string;
  detail: string;
  cta_link?: string;
};

type InsightRow = {
  id: string;
  pet_id: string;
  summary: string;
  insights: Insight[];
  generated_at: string;
};

const sevStyle = (s: Insight["severity"]) => {
  if (s === "action") return "bg-destructive/10 text-destructive border-destructive/30";
  if (s === "watch") return "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30";
  return "bg-primary-soft text-primary border-primary/20";
};

const sevIcon = (s: Insight["severity"]) => {
  if (s === "action") return <AlertTriangle className="h-3.5 w-3.5" />;
  if (s === "watch") return <Activity className="h-3.5 w-3.5" />;
  return <Info className="h-3.5 w-3.5" />;
};

export function HealthInsightsCard({ petId, petName }: { petId: string; petName: string }) {
  const nav = useNavigate();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["health-insights", petId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("health_insights" as any)
        .select("*")
        .eq("pet_id", petId)
        .maybeSingle();
      if (error && (error as any).code !== "PGRST116") throw error;
      return (data ?? null) as unknown as InsightRow | null;
    },
  });

  const gen = useMutation({
    mutationFn: async (force: boolean) => {
      const { data, error } = await supabase.functions.invoke("ai-health-insights", {
        body: { pet_id: petId, force },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (res: any) => {
      qc.invalidateQueries({ queryKey: ["health-insights", petId] });
      if (!res?.cached) toast.success("Health insights updated");
    },
    onError: (e: any) => {
      const msg = String(e?.message || e);
      if (msg.includes("rate_limited")) toast.error("Please wait a moment and try again");
      else if (msg.includes("credits_exhausted")) toast.error("AI credits exhausted — contact support");
      else toast.error("Couldn't generate insights");
    },
  });

  const stale = data
    ? Date.now() - new Date(data.generated_at).getTime() > 24 * 3600 * 1000
    : true;

  return (
    <Card className="rounded-2xl border-hairline bg-card shadow-none p-5 mb-3">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="h-9 w-9 rounded-xl bg-primary-soft flex items-center justify-center shrink-0">
            <Sparkles className="h-4.5 w-4.5 text-primary" strokeWidth={1.75} />
          </div>
          <div className="min-w-0">
            <div className="font-display text-base">AI Health Insights</div>
            <div className="text-[11px] text-muted-foreground">
              {data
                ? `Updated ${formatDistanceToNow(new Date(data.generated_at), { addSuffix: true })}`
                : "Not generated yet"}
            </div>
          </div>
        </div>
        <Button
          size="sm"
          variant={data ? "ghost" : "default"}
          onClick={() => gen.mutate(!!data)}
          disabled={gen.isPending}
          className="rounded-xl shrink-0"
        >
          {gen.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : data ? (
            <RefreshCw className="h-4 w-4" />
          ) : (
            "Generate"
          )}
        </Button>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground py-2">Loading…</div>
      ) : !data ? (
        <p className="text-sm text-muted-foreground">
          Tap Generate for an AI summary of {petName}'s recent weight, nutrition, symptoms and vaccinations.
        </p>
      ) : (
        <>
          <p className="text-sm leading-relaxed mb-3">{data.summary}</p>
          <div className="text-[10px] text-muted-foreground italic mb-2">
            AI-generated suggestions — not a substitute for veterinary advice.
          </div>
          {Array.isArray(data.insights) && data.insights.length > 0 && (
            <div className="space-y-2">
              {data.insights.map((ins, i) => (
                <button
                  key={i}
                  onClick={() => ins.cta_link && nav(ins.cta_link)}
                  className={`w-full text-left rounded-xl border p-3 transition-colors ${sevStyle(ins.severity)} ${ins.cta_link ? "hover:opacity-90 active:opacity-80" : "cursor-default"}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    {sevIcon(ins.severity)}
                    <div className="font-medium text-sm">{ins.title}</div>
                    <Badge variant="outline" className="ml-auto text-[10px] uppercase tracking-wide border-current/30 bg-transparent">
                      {ins.severity}
                    </Badge>
                  </div>
                  <div className="text-xs opacity-90 leading-relaxed">{ins.detail}</div>
                </button>
              ))}
            </div>
          )}
          {stale && (
            <div className="text-[11px] text-muted-foreground mt-3">
              Insights may be out of date — refresh for the latest.
            </div>
          )}
        </>
      )}
    </Card>
  );
}