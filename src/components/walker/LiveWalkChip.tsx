import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { MapPin } from "lucide-react";

/**
 * Renders a green "Walk in progress · Follow live" chip when the given
 * service-provider currently has an in-progress walk for the viewer.
 *
 * Looks for a recent walk_tracks row (≤ 3 min old) tied to a service_booking
 * between (providerId, customerId). If found, links to the public WalkLive
 * page using the booking's public_share_token.
 */
interface Props {
  providerId: string;
  customerId: string;
  className?: string;
}

export const LiveWalkChip = ({ providerId, customerId, className }: Props) => {
  const { data: token } = useQuery({
    queryKey: ["live-walk-chip", providerId, customerId],
    enabled: !!providerId && !!customerId,
    refetchInterval: 15_000,
    queryFn: async () => {
      // Find recent confirmed bookings between this customer and provider.
      const { data: bookings } = await supabase
        .from("service_bookings")
        .select("id, public_share_token, status")
        .eq("provider_id", providerId)
        .eq("customer_id", customerId)
        .in("status", ["confirmed"])
        .order("scheduled_at", { ascending: false })
        .limit(5);
      if (!bookings?.length) return null;

      // Pick whichever booking has a recent walk_tracks ping (≤3 min).
      const since = new Date(Date.now() - 3 * 60_000).toISOString();
      for (const b of bookings) {
        const { count } = await supabase
          .from("walk_tracks" as any)
          .select("id", { count: "exact", head: true })
          .eq("booking_id", b.id)
          .gte("recorded_at", since);
        if ((count ?? 0) > 0 && b.public_share_token) {
          return b.public_share_token as string;
        }
      }
      return null;
    },
  });

  if (!token) return null;

  return (
    <Link
      to={`/walk-live/${token}`}
      className={
        "inline-flex items-center gap-1.5 px-2.5 h-7 rounded-full text-[11px] font-semibold " +
        "bg-leaf/10 text-leaf border border-leaf/30 hover:bg-leaf/15 transition-colors " +
        (className ?? "")
      }
    >
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-leaf opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-leaf" />
      </span>
      <MapPin className="h-3 w-3" />
      Walk in progress · Follow live
    </Link>
  );
};

export default LiveWalkChip;