import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** All in-care/adopted journeys for one organisation. */
export const useOrgRescueJourneys = (orgId?: string | null) =>
  useQuery({
    queryKey: ["rescue-journeys", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rescue_journeys")
        .select("id, title, cover_url, started_at, status, pet_id")
        .eq("org_id", orgId!)
        .order("started_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

/** Single journey (header + entries + computed current day). */
export const useRescueJourney = (journeyId?: string | null) =>
  useQuery({
    queryKey: ["rescue-journey", journeyId],
    enabled: !!journeyId,
    queryFn: async () => {
      const [{ data: j }, { data: entries }] = await Promise.all([
        supabase.from("rescue_journeys").select("*").eq("id", journeyId!).maybeSingle(),
        supabase
          .from("rescue_journey_entries")
          .select("id, day_number, image_url, caption, created_at, post_id")
          .eq("journey_id", journeyId!)
          .order("day_number"),
      ]);
      if (!j) return null;
      const dayNow = Math.max(
        1,
        Math.floor((Date.now() - new Date(j.started_at).getTime()) / 86400000) + 1,
      );
      return { journey: j, entries: entries ?? [], currentDay: dayNow };
    },
  });