import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ArrowLeft, Plus, Car, MapPin, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const STATUS_LABEL: Record<string, string> = {
  requested: "Requested",
  accepted: "Accepted",
  en_route_pickup: "On the way",
  picked_up: "Picked up",
  en_route_drop: "Heading to drop",
  dropped_off: "Completed",
  cancelled: "Cancelled",
};

const Taxi = () => {
  const nav = useNavigate();
  const { user } = useAuth();

  const { data: trips, isLoading } = useQuery({
    queryKey: ["taxi-trips", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transport_bookings")
        .select("id, scheduled_at, status, pickup_address, dropoff_address, fare_inr, pets(name)")
        .eq("customer_id", user!.id)
        .order("scheduled_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-hairline">
        <div className="container-app h-14 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => nav(-1)}><ArrowLeft className="h-5 w-5" /></Button>
          <h1 className="font-display text-xl flex-1">Pet taxi</h1>
          <Button size="sm" className="rounded-full" onClick={() => nav("/taxi/new")}>
            <Plus className="h-4 w-4 mr-1" /> Book
          </Button>
        </div>
      </header>

      <main className="container-app py-6 space-y-3">
        {isLoading && <Card className="rounded-2xl border-hairline p-6 text-sm text-muted-foreground">Loading…</Card>}

        {!isLoading && (trips?.length ?? 0) === 0 && (
          <Card className="rounded-2xl border-hairline p-8 text-center">
            <Car className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <div className="font-medium">No taxi trips yet</div>
            <p className="text-sm text-muted-foreground mt-1">Book a verified driver to take your pet to the vet, groomer or boarding.</p>
            <Button asChild className="mt-4 rounded-full">
              <Link to="/taxi/new"><Plus className="h-4 w-4 mr-1" /> Book a pet taxi</Link>
            </Button>
          </Card>
        )}

        {trips?.map((t: any) => (
          <Card
            key={t.id}
            className="rounded-2xl border-hairline p-4 space-y-2 cursor-pointer hover:bg-muted/30"
            onClick={() => nav(`/taxi/${t.id}`)}
          >
            <div className="flex items-center justify-between">
              <Badge variant={t.status === "dropped_off" ? "secondary" : "default"} className="capitalize">
                {STATUS_LABEL[t.status] ?? t.status}
              </Badge>
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" /> {new Date(t.scheduled_at).toLocaleString()}
              </div>
            </div>
            <div className="text-sm space-y-1">
              <div className="flex gap-2"><MapPin className="h-4 w-4 text-primary shrink-0 mt-0.5" /><span className="line-clamp-1">{t.pickup_address}</span></div>
              <div className="flex gap-2"><MapPin className="h-4 w-4 text-destructive shrink-0 mt-0.5" /><span className="line-clamp-1">{t.dropoff_address}</span></div>
            </div>
            <div className="flex justify-between text-xs text-muted-foreground pt-1 border-t border-hairline">
              <span>{t.pets?.name ? `For ${t.pets.name}` : "—"}</span>
              {t.fare_inr ? <span>₹{t.fare_inr}</span> : <span>Fare TBC</span>}
            </div>
          </Card>
        ))}
      </main>
    </div>
  );
};

export default Taxi;
