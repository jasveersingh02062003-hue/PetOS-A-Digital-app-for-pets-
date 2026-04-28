import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, X, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

type Alert = {
  id: string;
  kind: string;
  title: string;
  body: string;
  link: string | null;
  severity: number;
  created_at: string;
};

export function ProactiveAlertsCard() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  const { data: alerts } = useQuery({
    queryKey: ["proactive_alerts", userId],
    enabled: !!userId,
    queryFn: async (): Promise<Alert[]> => {
      const { data, error } = await supabase
        .from("proactive_alerts")
        .select("id, kind, title, body, link, severity, created_at")
        .is("dismissed_at", null)
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return (data ?? []) as Alert[];
    },
  });

  // Realtime
  useEffect(() => {
    if (!userId) return;
    const ch = supabase
      .channel("proactive_alerts:home")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "proactive_alerts", filter: `user_id=eq.${userId}` },
        () => qc.invalidateQueries({ queryKey: ["proactive_alerts", userId] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [userId, qc]);

  async function dismiss(id: string) {
    await supabase
      .from("proactive_alerts")
      .update({ dismissed_at: new Date().toISOString() })
      .eq("id", id);
    qc.invalidateQueries({ queryKey: ["proactive_alerts", userId] });
  }

  if (!alerts || alerts.length === 0) return null;

  return (
    <section className="mt-3 mb-2 space-y-2">
      {alerts.map((a) => {
        const tone =
          a.severity >= 4
            ? "border-destructive/40 bg-destructive/5"
            : a.severity === 3
              ? "border-amber-500/40 bg-amber-500/5"
              : "border-primary/30 bg-primary/5";
        return (
          <div
            key={a.id}
            className={`rounded-2xl border ${tone} p-3 flex gap-3 items-start`}
          >
            <div className="mt-0.5 shrink-0 rounded-full bg-background p-1.5 border">
              <AlertTriangle className="h-4 w-4 text-foreground" />
            </div>
            <button
              type="button"
              onClick={() => a.link && nav(a.link)}
              className="flex-1 text-left"
            >
              <div className="text-sm font-semibold leading-snug flex items-center gap-1">
                {a.title}
                {a.link && <ChevronRight className="h-3.5 w-3.5 opacity-50" />}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{a.body}</p>
            </button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0 -mr-1"
              onClick={() => dismiss(a.id)}
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        );
      })}
    </section>
  );
}