import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

/**
 * Lightweight realtime presence layer.
 *
 * Joins a single global `presence:lobby` channel and tracks the current
 * user's id. Exposes a Set of online user ids that any component can read
 * via `useIsOnline(userId)`.
 *
 * This uses Supabase Realtime presence (in-memory only — no DB writes,
 * no extra tables, no overlap with the typing_indicators table).
 */
type PresenceCtx = { online: Set<string> };
const Ctx = createContext<PresenceCtx>({ online: new Set() });

export const PresenceProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [online, setOnline] = useState<Set<string>>(new Set());
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!user) {
      setOnline(new Set());
      return;
    }

    const channel = supabase.channel("presence:lobby", {
      config: { presence: { key: user.id } },
    });

    const sync = () => {
      const state = channel.presenceState() as Record<string, unknown[]>;
      setOnline(new Set(Object.keys(state)));
    };

    channel
      .on("presence", { event: "sync" }, sync)
      .on("presence", { event: "join" }, sync)
      .on("presence", { event: "leave" }, sync)
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ at: Date.now() });
        }
      });

    channelRef.current = channel;
    return () => {
      try { channel.untrack(); } catch { /* noop */ }
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [user]);

  const value = useMemo(() => ({ online }), [online]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};

/** Returns true if the given user id is currently online. */
export function useIsOnline(userId: string | null | undefined) {
  const { online } = useContext(Ctx);
  if (!userId) return false;
  return online.has(userId);
}

/** Returns the full set of online user ids (rarely needed). */
export function usePresenceSet() {
  return useContext(Ctx).online;
}