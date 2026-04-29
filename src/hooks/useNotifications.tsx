import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { logError } from "@/lib/logError";

export type Notification = {
  id: string;
  user_id: string;
  actor_id: string | null;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
};

export const useNotifications = () => {
  const { user } = useAuth();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["notifications", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as Notification[];
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (!user?.id) return;
    const channelName = `notif:${user.id}`;

    // Defensive: remove any pre-existing channel with the same name
    // (handles React StrictMode double-mount in dev).
    try {
      const existing = supabase
        .getChannels()
        .find((c) => c.topic === `realtime:${channelName}`);
      if (existing) supabase.removeChannel(existing);
    } catch (err) {
      logError(err, { source: "realtime:cleanup-pre" });
    }

    const channel = supabase.channel(channelName);
    try {
      channel
        .on(
          "postgres_changes" as any,
          {
            event: "INSERT",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${user.id}`,
          },
          (payload: any) => {
            const n = payload.new as Notification;
            toast(n.title, { description: n.body || undefined });
            qc.invalidateQueries({ queryKey: ["notifications", user.id] });
          },
        )
        .subscribe((status) => {
          if (import.meta.env.DEV) console.info("[useNotifications] sub status", status);
        });
    } catch (err) {
      logError(err, { source: "realtime:subscribe" });
    }

    return () => {
      try {
        supabase.removeChannel(channel);
      } catch (err) {
        logError(err, { source: "realtime:cleanup" });
      }
    };
  }, [user?.id, qc]);

  const unreadCount = (query.data ?? []).filter((n) => !n.read_at).length;

  const markAllRead = async () => {
    if (!user) return;
    await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .is("read_at", null);
    qc.invalidateQueries({ queryKey: ["notifications", user.id] });
  };

  const markRead = async (id: string) => {
    await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", id);
    qc.invalidateQueries({ queryKey: ["notifications", user?.id] });
  };

  return { ...query, unreadCount, markAllRead, markRead };
};
