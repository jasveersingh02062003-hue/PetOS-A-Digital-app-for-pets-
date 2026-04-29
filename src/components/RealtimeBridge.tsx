import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Mounts long-lived realtime subscriptions once per session.
 * Currently:
 *  - org_profiles changes → invalidate verified-orgs + org-identities so the
 *    verified tick & org name/logo flip immediately when an admin approves.
 */
export const RealtimeBridge = () => {
  const qc = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel("verified-orgs-watch")
      .on(
        "postgres_changes" as any,
        { event: "*", schema: "public", table: "org_profiles" },
        () => {
          qc.invalidateQueries({ queryKey: ["verified-orgs"] });
          qc.invalidateQueries({ queryKey: ["org-identities"] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  return null;
};

export default RealtimeBridge;