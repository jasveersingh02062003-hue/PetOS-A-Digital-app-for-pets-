import { useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Calendar, MapPin, MessageSquare, Footprints } from "lucide-react";
import { toast } from "sonner";
import { StatusProgress } from "@/components/booking/StatusProgress";
import { SERVICE_BOOKING_FLOW, SERVICE_BOOKING_LABELS } from "@/lib/bookingFlows";

const BookingDetail = () => {
  const { id } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: booking } = useQuery({
    queryKey: ["service-booking", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_bookings")
        .select("*")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const [{ data: prov }, { data: pet }] = await Promise.all([
        supabase.from("service_providers")
          .select("id, name, category, owner_id, contact_phone, lat, lng, city, cover_url")
          .eq("id", data.provider_id).maybeSingle(),
        data.pet_id
          ? supabase.from("pets").select("name, avatar_url").eq("id", data.pet_id).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
      return { ...data, provider: prov, pet };
    },
  });

  // Realtime
  useEffect(() => {
    if (!id) return;
    const ch = supabase
      .channel(`booking:${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "service_bookings", filter: `id=eq.${id}` },
        () => qc.invalidateQueries({ queryKey: ["service-booking", id] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id, qc]);

  if (!booking) {
    return <div className="container-app pad-top-safe py-10 text-sm text-muted-foreground">Loading…</div>;
  }

  const isProvider = !!user && booking.provider?.owner_id === user.id;
  const isCustomer = !!user && booking.customer_id === user.id;
  const isWalker = booking.provider?.category === "walking";
  const status = booking.status as string;

  const setStatus = async (s: string) => {
    const { error } = await supabase
      .from("service_bookings")
      .update({ status: s as any })
      .eq("id", booking.id);
    if (error) return toast.error(error.message);
    toast.success(SERVICE_BOOKING_LABELS[s] ?? s);
  };

  const cancelled = status === "cancelled" || status === "declined";

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-hairline">
        <div className="container-app h-14 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => nav(-1)}><ArrowLeft className="h-5 w-5" /></Button>
          <h1 className="font-display text-xl flex-1">Booking</h1>
        </div>
      </header>

      <main className="container-app py-4 space-y-3">
        <Card className="rounded-2xl border-hairline p-4 space-y-3">
          <div className="flex items-center justify-between">
            <Badge variant={cancelled ? "destructive" : status === "completed" ? "secondary" : "default"} className="capitalize">
              {SERVICE_BOOKING_LABELS[status] ?? status}
            </Badge>
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              {new Date(booking.scheduled_at).toLocaleString()}
            </div>
          </div>
          {!cancelled && (
            <StatusProgress
              flow={SERVICE_BOOKING_FLOW}
              status={(["pending","confirmed","in_progress","completed"].includes(status) ? status : "pending") as any}
              labels={SERVICE_BOOKING_LABELS as any}
              liveStatuses={["in_progress"] as const}
            />
          )}
        </Card>

        <Card className="rounded-2xl border-hairline p-4 space-y-2">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-primary-soft overflow-hidden flex items-center justify-center">
              {booking.provider?.cover_url ? (
                <img src={booking.provider.cover_url} alt={booking.provider.name} className="h-full w-full object-cover" />
              ) : (
                <Footprints className="h-5 w-5 text-primary" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <Link to={`/services/${booking.provider?.id}`} className="font-display text-base leading-tight truncate hover:underline">
                {booking.provider?.name ?? "Provider"}
              </Link>
              <div className="text-xs text-muted-foreground capitalize">
                {booking.provider?.category} {booking.provider?.city ? `· ${booking.provider.city}` : ""}
              </div>
            </div>
          </div>
          {booking.pet?.name && (
            <div className="text-xs text-muted-foreground border-t border-hairline pt-2">
              Pet: {booking.pet.name}
            </div>
          )}
          {booking.notes && (
            <div className="text-xs text-muted-foreground border-t border-hairline pt-2">
              <MessageSquare className="h-3 w-3 inline mr-1" /> {booking.notes}
            </div>
          )}
        </Card>

        {isWalker && status === "in_progress" && (
          <Button asChild className="w-full rounded-full">
            <Link to={`/walk/${booking.id}`}>
              <MapPin className="h-4 w-4 mr-1.5" /> Open live walk map
            </Link>
          </Button>
        )}

        {isProvider && !cancelled && status !== "completed" && (
          <div className="flex gap-2 flex-wrap">
            {status === "pending" && (
              <Button size="sm" className="rounded-full flex-1" onClick={() => setStatus("confirmed")}>Confirm</Button>
            )}
            {status === "confirmed" && (
              <Button size="sm" className="rounded-full flex-1" onClick={() => setStatus("in_progress")}>Start</Button>
            )}
            {status === "in_progress" && (
              <Button size="sm" className="rounded-full flex-1" onClick={() => setStatus("completed")}>Complete</Button>
            )}
            <Button size="sm" variant="outline" className="rounded-full" onClick={() => setStatus("declined")}>Decline</Button>
          </div>
        )}

        {isCustomer && !cancelled && status !== "completed" && (
          <Button size="sm" variant="outline" className="rounded-full w-full"
            onClick={() => { if (confirm("Cancel this booking?")) setStatus("cancelled"); }}>
            Cancel booking
          </Button>
        )}
      </main>
    </div>
  );
};

export default BookingDetail;
