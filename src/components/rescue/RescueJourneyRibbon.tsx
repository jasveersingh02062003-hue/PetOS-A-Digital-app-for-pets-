import { Link } from "react-router-dom";
import { Heart } from "lucide-react";
import { useRescueJourney } from "@/hooks/useRescueJourneys";

/**
 * Lilac corner ribbon shown on top of a post photo when the post is tagged
 * to a rescue journey. Tap → full timeline page.
 */
export const RescueJourneyRibbon = ({ journeyId }: { journeyId?: string | null }) => {
  const { data } = useRescueJourney(journeyId);
  if (!journeyId || !data) return null;
  const { journey, currentDay } = data;
  return (
    <Link
      to={`/rescue/${journey.id}`}
      onClick={(e) => e.stopPropagation()}
      className="absolute top-2 left-2 z-10 inline-flex items-center gap-1.5 px-2.5 h-7 rounded-full bg-lilac text-lilac-foreground text-[11px] font-semibold shadow-md backdrop-blur-sm"
    >
      <Heart className="h-3 w-3" fill="currentColor" />
      Rescue Journey · Day {currentDay}
    </Link>
  );
};