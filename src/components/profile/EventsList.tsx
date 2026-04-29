import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { CalendarDays, MapPin, Users } from "lucide-react";
import { format } from "date-fns";

/**
 * Upcoming meetups/events hosted by `userId`.
 * Used on zoo / sanctuary profiles where "events" is a primary surface.
 */
export const EventsList = ({ userId }: { userId: string }) => {
  const { data, isLoading } = useQuery({
    queryKey: ["profile-events", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meetups")
        .select("id, title, city, venue, starts_at, cover_url, attending_count, capacity, status")
        .eq("host_id", userId)
        .order("starts_at", { ascending: true })
        .limit(40);
      if (error) throw error;
      return data ?? [];
    },
  });

  if (isLoading) return <div className="py-6 text-center text-sm text-muted-foreground">Loading…</div>;
  if (!data?.length) {
    return (
      <Card className="rounded-2xl border-hairline p-6 text-center">
        <CalendarDays className="h-7 w-7 mx-auto text-muted-foreground mb-2" strokeWidth={1.5} />
        <div className="text-sm text-muted-foreground">No upcoming events.</div>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {data.map((m: any) => (
        <Link key={m.id} to={`/meetups/${m.id}`}>
          <Card className="rounded-2xl border-hairline shadow-none p-3 flex items-center gap-3 hover:bg-muted/40 transition">
            <div className="h-14 w-14 rounded-xl bg-muted overflow-hidden shrink-0">
              {m.cover_url ? (
                <img src={m.cover_url} alt="" className="w-full h-full object-cover" loading="lazy" />
              ) : (
                <div className="w-full h-full grid place-items-center"><CalendarDays className="h-5 w-5 text-muted-foreground" /></div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{m.title}</div>
              <div className="text-[11px] text-muted-foreground flex items-center gap-2 mt-0.5">
                <span className="inline-flex items-center gap-1">
                  <CalendarDays className="h-3 w-3" />
                  {m.starts_at ? format(new Date(m.starts_at), "MMM d, p") : ""}
                </span>
                {m.city && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{m.city}</span>}
                <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" />{m.attending_count ?? 0}{m.capacity ? `/${m.capacity}` : ""}</span>
              </div>
            </div>
          </Card>
        </Link>
      ))}
    </div>
  );
};

export default EventsList;