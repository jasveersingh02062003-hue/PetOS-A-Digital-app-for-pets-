import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Heart } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SmartImage } from "@/components/SmartImage";
import { useRescueJourney } from "@/hooks/useRescueJourneys";
import { formatDistanceToNow } from "date-fns";

const STATUS_LABEL: Record<string, string> = {
  in_care: "In care",
  adopted: "Adopted ❤️",
  rip: "Rest in peace 🌈",
};

const RescueJourneyDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading } = useRescueJourney(id);

  if (isLoading) {
    return (
      <div className="container-app pt-10 text-center text-muted-foreground">Loading…</div>
    );
  }
  if (!data) {
    return (
      <div className="container-app pt-10 text-center text-muted-foreground">
        Journey not found
      </div>
    );
  }

  const { journey, entries, currentDay } = data;

  return (
    <div className="container-app pt-4 pb-24 max-w-2xl">
      <Link to="/" className="flex items-center gap-1 text-sm text-muted-foreground mb-3">
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>

      <div className="rounded-2xl overflow-hidden border border-hairline mb-4">
        <div className="aspect-[16/9] bg-lilac/10 relative">
          {journey.cover_url ? (
            <SmartImage src={journey.cover_url} alt={journey.title} aspect="16/9" className="w-full h-full" />
          ) : entries[0]?.image_url ? (
            <SmartImage src={entries[0].image_url} alt={journey.title} aspect="16/9" className="w-full h-full" />
          ) : (
            <div className="w-full h-full grid place-items-center">
              <Heart className="h-10 w-10 text-lilac" fill="currentColor" />
            </div>
          )}
          <Badge className="absolute top-3 left-3 bg-lilac text-lilac-foreground border-0 gap-1.5">
            <Heart className="h-3 w-3" fill="currentColor" /> Rescue Journey · Day {currentDay}
          </Badge>
        </div>
        <div className="p-4">
          <h1 className="font-display text-2xl leading-tight">{journey.title}</h1>
          <div className="text-xs text-muted-foreground mt-1">
            Started {formatDistanceToNow(new Date(journey.started_at), { addSuffix: true })} ·{" "}
            {STATUS_LABEL[journey.status] ?? journey.status}
          </div>
        </div>
      </div>

      {entries.length === 0 ? (
        <Card className="rounded-2xl border-hairline p-6 text-center text-sm text-muted-foreground">
          No entries yet. New posts tagged to this journey will appear here.
        </Card>
      ) : (
        <div className="space-y-4">
          {entries.map((e) => (
            <Card key={e.id} className="rounded-2xl border-hairline overflow-hidden">
              {e.image_url && (
                <SmartImage src={e.image_url} alt={`Day ${e.day_number}`} aspect="1/1" className="w-full" />
              )}
              <div className="p-4">
                <div className="inline-flex items-center gap-1.5 px-2.5 h-6 rounded-full bg-lilac/15 text-lilac text-[11px] font-semibold mb-2">
                  Day {e.day_number}
                </div>
                {e.caption && (
                  <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/90">
                    {e.caption}
                  </p>
                )}
                <div className="text-[11px] text-muted-foreground mt-2">
                  {formatDistanceToNow(new Date(e.created_at), { addSuffix: true })}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default RescueJourneyDetail;