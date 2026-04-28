import { useNavigate } from "react-router-dom";
import { useUpcomingMeetups } from "@/hooks/useMeetups";
import { useProfile } from "@/hooks/useProfile";
import { MeetupCard } from "@/components/social/MeetupCard";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/EmptyState";
import { MeetupListSkeleton } from "@/components/skeletons/FeedSkeleton";
import { ArrowLeft, CalendarPlus, Users } from "lucide-react";

const Meetups = () => {
  const nav = useNavigate();
  const { data: profile } = useProfile();
  const { data: cityMeetups } = useUpcomingMeetups(profile?.city);
  const { data: allMeetups } = useUpcomingMeetups();

  const list = (cityMeetups && cityMeetups.length > 0) ? cityMeetups : allMeetups;
  const loading = cityMeetups === undefined && allMeetups === undefined;

  return (
    <div className="container-app pad-top-safe pb-16">
      <header className="pt-4 pb-3 flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => nav(-1)}><ArrowLeft className="h-5 w-5" /></Button>
        <h1 className="font-display text-2xl flex-1">Meetups</h1>
        <Button size="sm" className="rounded-full" onClick={() => nav("/meetups/new")}>
          <CalendarPlus className="h-4 w-4 mr-1.5" /> Host
        </Button>
      </header>

      {profile?.city && (
        <div className="text-xs text-muted-foreground mb-3">
          {(cityMeetups?.length ?? 0) > 0 ? `Upcoming in ${profile.city}` : `No meetups in ${profile.city} yet — showing all`}
        </div>
      )}

      <div className="space-y-3">
        {loading ? (
          <MeetupListSkeleton count={4} />
        ) : (
        <>
        {(list ?? []).map((m) => <MeetupCard key={m.id} meetup={m} />)}
        {(!list || list.length === 0) && (
          <EmptyState
            icon={Users}
            title="No upcoming meetups"
            description="Be the first to host a playdate in your area."
            ctaLabel="Host a meetup"
            onCta={() => nav("/meetups/new")}
          />
        )}
        </>
        )}
      </div>
    </div>
  );
};

export default Meetups;
