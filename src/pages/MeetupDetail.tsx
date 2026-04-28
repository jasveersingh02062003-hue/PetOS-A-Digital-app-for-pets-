import { useParams, useNavigate, Link } from "react-router-dom";
import { useMeetup, useMeetupRsvps } from "@/hooks/useMeetups";
import { RsvpButton } from "@/components/social/RsvpButton";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Calendar, MapPin, Users } from "lucide-react";
import { LeafletMap } from "@/components/maps/LeafletMap";
import { pawIcon } from "@/components/maps/PawMarker";

const fmt = (iso: string) => new Date(iso).toLocaleString(undefined, {
  weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit",
});

const MeetupDetail = () => {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const { data: m, isLoading } = useMeetup(id);
  const { data: rsvps } = useMeetupRsvps(id);

  if (isLoading) return <div className="container-app pad-top-safe pt-10 text-muted-foreground">Loading…</div>;
  if (!m) return <div className="container-app pad-top-safe pt-10 text-muted-foreground">Meetup not found.</div>;

  return (
    <div className="container-app pad-top-safe pb-16">
      <header className="pt-4 pb-3">
        <Button variant="ghost" size="icon" onClick={() => nav(-1)}><ArrowLeft className="h-5 w-5" /></Button>
      </header>

      <div className="rounded-2xl bg-gradient-to-br from-primary/10 to-accent/10 p-6 mb-4">
        <h1 className="font-display text-2xl">{m.title}</h1>
        <div className="text-sm text-muted-foreground mt-3 flex items-center gap-1.5">
          <Calendar className="h-4 w-4" /> {fmt(m.starts_at)}
        </div>
        {m.venue && (
          <div className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5">
            <MapPin className="h-4 w-4" /> {m.venue}{m.city ? `, ${m.city}` : ""}
          </div>
        )}
        <div className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5">
          <Users className="h-4 w-4" /> {m.attending_count}{m.capacity ? `/${m.capacity}` : ""} going
        </div>
        <div className="mt-4">
          <Link to={`/u/${m.host_id}`} className="text-xs text-muted-foreground underline">View host</Link>
        </div>
      </div>

      {m.description && <p className="text-sm whitespace-pre-wrap mb-5">{m.description}</p>}

      {m.lat != null && m.lng != null && (
        <div className="mb-5">
          <LeafletMap
            center={[Number(m.lat), Number(m.lng)]}
            zoom={14}
            height="220px"
            markers={[{
              id: m.id,
              lat: Number(m.lat),
              lng: Number(m.lng),
              icon: pawIcon("#3b82f6"),
              title: m.title,
              description: [m.venue, m.city].filter(Boolean).join(", "),
            }]}
          />
        </div>
      )}

      <div className="mb-6">
        <RsvpButton meetupId={m.id} />
      </div>

      <h2 className="font-display text-lg mb-2">Attendees ({rsvps?.length ?? 0})</h2>
      <div className="text-sm text-muted-foreground">
        {(rsvps ?? []).length === 0 ? "No-one yet — be the first!" : `${rsvps!.length} pet parent${rsvps!.length === 1 ? "" : "s"} going.`}
      </div>
    </div>
  );
};

export default MeetupDetail;
