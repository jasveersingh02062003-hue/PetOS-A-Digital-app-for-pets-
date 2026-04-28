import { Link } from "react-router-dom";
import { Calendar, MapPin, Users } from "lucide-react";
import type { Meetup } from "@/hooks/useMeetups";

const fmt = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" }) +
    " · " +
    d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
};

export const MeetupCard = ({ meetup }: { meetup: Meetup }) => {
  return (
    <Link
      to={`/meetups/${meetup.id}`}
      className="block rounded-2xl border border-border bg-card p-4 hover:border-primary/40 transition-colors"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-display text-base truncate">{meetup.title}</h3>
          <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
            <Calendar className="h-3 w-3" /> {fmt(meetup.starts_at)}
          </div>
          {meetup.venue && (
            <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1 truncate">
              <MapPin className="h-3 w-3 shrink-0" /> {meetup.venue}{meetup.city ? `, ${meetup.city}` : ""}
            </div>
          )}
        </div>
        <div className="text-xs text-muted-foreground flex items-center gap-1 shrink-0">
          <Users className="h-3 w-3" /> {meetup.attending_count}
          {meetup.capacity ? `/${meetup.capacity}` : ""}
        </div>
      </div>
      {meetup.description && (
        <p className="text-xs text-muted-foreground line-clamp-2 mt-2">{meetup.description}</p>
      )}
    </Link>
  );
};
