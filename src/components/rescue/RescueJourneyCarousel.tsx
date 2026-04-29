import { Link } from "react-router-dom";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SmartImage } from "@/components/SmartImage";
import { useRescueJourney } from "@/hooks/useRescueJourneys";

/**
 * Horizontal Day-N strip shown under a post body. Live-updates via realtime
 * as the shelter posts new days for the same journey.
 */
export const RescueJourneyCarousel = ({ journeyId }: { journeyId?: string | null }) => {
  const { data } = useRescueJourney(journeyId);
  const qc = useQueryClient();

  useEffect(() => {
    if (!journeyId) return;
    const ch = supabase
      .channel(`rescue-journey-${journeyId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "rescue_journey_entries",
          filter: `journey_id=eq.${journeyId}`,
        },
        () => qc.invalidateQueries({ queryKey: ["rescue-journey", journeyId] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [journeyId, qc]);

  if (!journeyId || !data || data.entries.length === 0) return null;

  return (
    <div className="px-4 pt-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
          {data.journey.title}
        </div>
        <Link
          to={`/rescue/${data.journey.id}`}
          className="text-[11px] text-lilac font-semibold hover:underline"
        >
          See full journey →
        </Link>
      </div>
      <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1 pb-1">
        {data.entries.map((e) => (
          <div
            key={e.id}
            className="shrink-0 w-24 rounded-xl border border-hairline overflow-hidden bg-card"
          >
            <div className="aspect-square bg-muted">
              {e.image_url && (
                <SmartImage src={e.image_url} aspect="1/1" className="w-full h-full" alt="" />
              )}
            </div>
            <div className="px-1.5 py-1 text-[10px] font-semibold text-center bg-lilac/10 text-lilac">
              Day {e.day_number}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};