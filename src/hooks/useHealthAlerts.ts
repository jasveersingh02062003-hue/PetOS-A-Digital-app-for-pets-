import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type HealthAlert = {
  id: string;
  owner_id: string;
  pet_id: string | null;
  kind: string;
  severity: "info" | "watch" | "action" | "emergency";
  title: string;
  body: string | null;
  link: string | null;
  dedupe_key: string | null;
  created_at: string;
  read_at: string | null;
  dismissed_at: string | null;
};

export const useHealthAlerts = () => {
  const { user } = useAuth();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["health-alerts", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("health_alerts" as any)
        .select("*")
        .is("dismissed_at", null)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as unknown as HealthAlert[];
    },
  });

  useEffect(() => {
    if (!user?.id) return;
    const ch = supabase
      .channel("health-alerts-" + user.id)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "health_alerts", filter: `owner_id=eq.${user.id}` },
        () => {
          qc.invalidateQueries({ queryKey: ["health-alerts", user.id] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user?.id, qc]);

  const alerts = query.data ?? [];
  const unread = alerts.filter((a) => !a.read_at);
  const emergencies = alerts.filter((a) => a.severity === "emergency" && !a.dismissed_at);

  const markRead = async (id: string) => {
    await supabase.from("health_alerts" as any).update({ read_at: new Date().toISOString() }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["health-alerts", user?.id] });
  };

  const markAllRead = async () => {
    if (!user?.id) return;
    await supabase.from("health_alerts" as any).update({ read_at: new Date().toISOString() }).is("read_at", null).eq("owner_id", user.id);
    qc.invalidateQueries({ queryKey: ["health-alerts", user.id] });
  };

  const dismiss = async (id: string) => {
    await supabase.from("health_alerts" as any).update({ dismissed_at: new Date().toISOString() }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["health-alerts", user?.id] });
  };

  return { alerts, unread, emergencies, markRead, markAllRead, dismiss, isLoading: query.isLoading };
};
