import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ArrowLeft, Car, MapPin, Phone, Share2, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { PayButton } from "@/components/payments/PayButton";
import { RefundButton } from "@/components/payments/RefundButton";
import { Link } from "react-router-dom";
import { FileText } from "lucide-react";

type Status = "requested"|"accepted"|"en_route_pickup"|"picked_up"|"en_route_drop"|"dropped_off"|"cancelled";

const FLOW: Status[] = ["requested","accepted","en_route_pickup","picked_up","en_route_drop","dropped_off"];
const LABEL: Record<Status, string> = {
  requested: "Requested", accepted: "Accepted", en_route_pickup: "Driver on way to pickup",
  picked_up: "Pet picked up", en_route_drop: "On the way to drop-off",
  dropped_off: "Dropped off safely", cancelled: "Cancelled",
};

const TaxiDetail = () => {
  const { id } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: trip, refetch } = useQuery({
    queryKey: ["taxi", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transport_bookings")
        .select("*, pets(name), service_providers(name, contact_phone, owner_id)")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: legs } = useQuery({
    queryKey: ["taxi-legs", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transport_legs")
        .select("id, kind, at, note")
        .eq("booking_id", id!)
        .order("at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  // realtime
  useEffect(() => {
    if (!id) return;
    const ch = supabase
      .channel(`taxi:${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "transport_bookings", filter: `id=eq.${id}` },
        () => { refetch(); qc.invalidateQueries({ queryKey: ["taxi-legs", id] }); })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "transport_legs", filter: `booking_id=eq.${id}` },
        () => qc.invalidateQueries({ queryKey: ["taxi-legs", id] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id, qc, refetch]);

  if (!trip) return <div className="container-app py-10 text-sm text-muted-foreground">Loading…</div>;

  const isCustomer = user?.id === trip.customer_id;
  const isDriver = user?.id === trip.service_providers?.owner_id;
  const status = trip.status as Status;
  const tripExt = trip as typeof trip & { payment_intent_id?: string | null; paid_at?: string | null };

  const setStatus = async (s: Status) => {
    const { error } = await supabase.from("transport_bookings").update({ status: s }).eq("id", trip.id);
    if (error) { toast.error(error.message); return; }
    toast.success(LABEL[s]);
  };

  const cancel = async () => {
    if (!confirm("Cancel this trip?")) return;
    await setStatus("cancelled");
  };

  const share = async () => {
    const url = `${window.location.origin}/taxi/share/${trip.public_share_token}`;
    try {
      await navigator.share?.({ title: "Live pet taxi", url });
    } catch {
      navigator.clipboard.writeText(url);
      toast.success("Live tracking link copied");
    }
  };

  // next status the driver should advance to
  const nextStatus: Status | null = (() => {
    if (!isDriver) return null;
    const idx = FLOW.indexOf(status);
    if (idx === -1 || idx >= FLOW.length - 1) return null;
    return FLOW[idx + 1];
  })();

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-hairline">
        <div className="container-app h-14 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => nav(-1)}><ArrowLeft className="h-5 w-5" /></Button>
          <h1 className="font-display text-xl flex-1">Trip details</h1>
          <Button variant="ghost" size="icon" onClick={share} aria-label="Share live link"><Share2 className="h-5 w-5" /></Button>
        </div>
      </header>

      <main className="container-app py-6 space-y-4">
        <Card className="rounded-2xl border-hairline p-4 space-y-3">
          <div className="flex items-center justify-between">
            <Badge variant={status === "dropped_off" ? "secondary" : status === "cancelled" ? "destructive" : "default"}>
              {LABEL[status]}
            </Badge>
            <div className="text-xs text-muted-foreground">{new Date(trip.scheduled_at).toLocaleString()}</div>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex gap-2"><MapPin className="h-4 w-4 text-primary shrink-0 mt-0.5" /><span>{trip.pickup_address}</span></div>
            <div className="flex gap-2"><MapPin className="h-4 w-4 text-destructive shrink-0 mt-0.5" /><span>{trip.dropoff_address}</span></div>
          </div>
          {trip.pets?.name && <div className="text-xs text-muted-foreground">Pet: {trip.pets.name}</div>}
          {trip.notes && <div className="text-xs text-muted-foreground border-t border-hairline pt-2">{trip.notes}</div>}
          {trip.fare_inr && <div className="text-sm font-medium">Fare: ₹{trip.fare_inr}</div>}
        </Card>

        {trip.service_providers && (
          <Card className="rounded-2xl border-hairline p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Car className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{trip.service_providers.name}</div>
              <div className="text-xs text-muted-foreground">Assigned driver</div>
            </div>
            {trip.service_providers.contact_phone && (
              <Button asChild size="icon" variant="ghost"><a href={`tel:${trip.service_providers.contact_phone}`}><Phone className="h-4 w-4" /></a></Button>
            )}
          </Card>
        )}

        {/* Driver controls */}
        {isDriver && status !== "cancelled" && nextStatus && (
          <Button className="w-full rounded-xl h-11" onClick={() => setStatus(nextStatus)}>
            <Check className="h-4 w-4 mr-1" /> Mark: {LABEL[nextStatus]}
          </Button>
        )}

        {/* Customer cancel */}
        {isCustomer && !["dropped_off","cancelled"].includes(status) && (
          <Button variant="outline" className="w-full rounded-xl h-10 text-destructive" onClick={cancel}>
            <X className="h-4 w-4 mr-1" /> Cancel trip
          </Button>
        )}

        {/* Payment block */}
        {isCustomer && trip.fare_inr && !tripExt.payment_intent_id && status !== "cancelled" && (
          <PayButton
            kind="transport"
            refId={trip.id}
            productName={`Pet taxi · ${trip.pickup_address?.slice(0,30) ?? "trip"}`}
            amountInr={trip.fare_inr}
            next={`/taxi/${trip.id}`}
            className="w-full rounded-xl h-11"
          />
        )}
        {tripExt.payment_intent_id && (
          <Card className="rounded-2xl border-hairline p-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm">
              <FileText className="h-4 w-4 text-primary" />
              <span>Paid · receipt available</span>
            </div>
            <div className="flex items-center gap-2">
              <Button asChild size="sm" variant="outline">
                <Link to={`/receipt/${tripExt.payment_intent_id}`}>View receipt</Link>
              </Button>
              {isCustomer && (
                <RefundButton intentId={tripExt.payment_intent_id!} amountInr={trip.fare_inr ?? 0} onRefunded={refetch} />
              )}
            </div>
          </Card>
        )}

        {/* Timeline */}
        <Card className="rounded-2xl border-hairline p-4">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-3">Timeline</div>
          {(legs?.length ?? 0) === 0 ? (
            <div className="text-sm text-muted-foreground">No updates yet.</div>
          ) : (
            <ol className="space-y-3">
              {legs!.map(l => (
                <li key={l.id} className="flex gap-3">
                  <div className="h-2 w-2 rounded-full bg-primary mt-2 shrink-0" />
                  <div className="flex-1">
                    <div className="text-sm">{LABEL[l.kind as Status] ?? l.kind}</div>
                    <div className="text-xs text-muted-foreground">{new Date(l.at).toLocaleString()}</div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </main>
    </div>
  );
};

export default TaxiDetail;
