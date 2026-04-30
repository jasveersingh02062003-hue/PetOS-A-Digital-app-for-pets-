import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useUserLocation } from "@/hooks/useUserLocation";

/**
 * Mounts long-lived realtime subscriptions once per session.
 * Currently:
 *  - org_profiles changes → invalidate verified-orgs + org-identities so the
 *    verified tick & org name/logo flip immediately when an admin approves.
 */
export const RealtimeBridge = () => {
  const qc = useQueryClient();
  const nav = useNavigate();
  const { coords } = useUserLocation();
  const coordsRef = useRef(coords);
  useEffect(() => { coordsRef.current = coords; }, [coords]);

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

  // In-app "missing pet near you" toast — fires on INSERT within 10 km of the user.
  useEffect(() => {
    const ch = supabase
      .channel("missing-near-me-bridge")
      .on("postgres_changes" as any,
        { event: "INSERT", schema: "public", table: "missing_pets" },
        (payload: any) => {
          const c = coordsRef.current;
          const row = payload?.new;
          if (!c || !row?.last_seen_lat || !row?.last_seen_lng) return;
          const toRad = (x: number) => (x * Math.PI) / 180;
          const R = 6371;
          const dLat = toRad(Number(row.last_seen_lat) - c.lat);
          const dLng = toRad(Number(row.last_seen_lng) - c.lng);
          const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(c.lat)) * Math.cos(toRad(Number(row.last_seen_lat))) * Math.sin(dLng / 2) ** 2;
          const km = 2 * R * Math.asin(Math.sqrt(a));
          if (km > 10) return;
          toast(`🐾 Missing pet reported ${km < 1 ? "<1" : km.toFixed(1)} km away`, {
            description: row.last_seen_city ?? "Tap to help reunite",
            action: { label: "View", onClick: () => nav(`/missing/${row.id}`) },
            duration: 8000,
          });
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [nav]);

  return null;
};

export default RealtimeBridge;