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

  // In-app "new mate listing near you" — uses owner's profile location indirectly
  // via a query lookup; falls back to the listing's own city. Fires within 25 km.
  useEffect(() => {
    const ch = supabase
      .channel("mate-near-me-bridge")
      .on("postgres_changes" as any,
        { event: "INSERT", schema: "public", table: "mating_listings" },
        async (payload: any) => {
          const c = coordsRef.current;
          const row = payload?.new;
          if (!c || !row?.pet_id || row?.active === false) return;
          // Look up pet + owner profile lat/lng
          const { data: pet } = await supabase
            .from("pets").select("name, breed, species, owner_id").eq("id", row.pet_id).maybeSingle();
          if (!pet?.owner_id) return;
          const { data: prof } = await supabase
            .from("profiles").select("lat, lng").eq("id", pet.owner_id).maybeSingle();
          if (prof?.lat == null || prof?.lng == null) return;
          const toRad = (x: number) => (x * Math.PI) / 180;
          const R = 6371;
          const dLat = toRad(Number(prof.lat) - c.lat);
          const dLng = toRad(Number(prof.lng) - c.lng);
          const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(c.lat)) * Math.cos(toRad(Number(prof.lat))) * Math.sin(dLng / 2) ** 2;
          const km = 2 * R * Math.asin(Math.sqrt(a));
          if (km > 25) return;
          // Refresh the mates grid in the background.
          qc.invalidateQueries({ queryKey: ["discover_mating_listings"] });
          toast(`🐶 New mate ${km < 1 ? "<1" : km.toFixed(1)} km away`, {
            description: `${pet.breed ?? pet.species ?? "A pet"} just listed nearby`,
            action: { label: "View", onClick: () => nav(`/mates/${row.id}`) },
            duration: 7000,
          });
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [nav, qc]);

  return null;
};

export default RealtimeBridge;