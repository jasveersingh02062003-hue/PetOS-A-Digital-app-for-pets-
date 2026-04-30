import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Star, Clock, Check } from "lucide-react";
import { toast } from "sonner";

type Bid = {
  id: string;
  driver_provider_id: string;
  driver_user_id: string;
  price_inr: number;
  eta_minutes: number;
  distance_km: number | null;
  status: string;
  created_at: string;
  provider?: { name: string | null; verified: boolean | null } | null;
};

/** Customer-side: live list of driver bids on a requested trip. */
export function BidsList({ bookingId }: { bookingId: string }) {
  const qc = useQueryClient();

  const { data: bids } = useQuery({
    queryKey: ["taxi-bids", bookingId],
    queryFn: async (): Promise<Bid[]> => {
      const { data, error } = await supabase
        .from("taxi_bids" as any)
        .select("id, driver_provider_id, driver_user_id, price_inr, eta_minutes, distance_km, status, created_at, provider:service_providers!taxi_bids_driver_provider_id_fkey(name, verified)")
        .eq("booking_id", bookingId)
        .order("price_inr", { ascending: true });
      if (error) return [];
      return (data ?? []) as unknown as Bid[];
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel(`bids:${bookingId}`)
      .on("postgres_changes" as any,
        { event: "*", schema: "public", table: "taxi_bids", filter: `booking_id=eq.${bookingId}` },
        () => qc.invalidateQueries({ queryKey: ["taxi-bids", bookingId] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [bookingId, qc]);

  const open = (bids ?? []).filter((b) => b.status === "open");

  const accept = async (bidId: string) => {
    const { error } = await supabase
      .from("taxi_bids" as any)
      .update({ status: "accepted" })
      .eq("id", bidId);
    if (error) return toast.error(error.message);
    toast.success("Driver accepted — they're on the way");
    qc.invalidateQueries({ queryKey: ["taxi", bookingId] });
    qc.invalidateQueries({ queryKey: ["taxi-bids", bookingId] });
  };

  if (open.length === 0) {
    return (
      <Card className="rounded-2xl border-hairline p-4 text-sm text-muted-foreground text-center">
        Waiting for nearby drivers to bid…
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl border-hairline p-3 space-y-2">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground px-1">
        {open.length} driver{open.length === 1 ? "" : "s"} bidding
      </div>
      {open.map((b) => (
        <div key={b.id} className="flex items-center gap-3 p-2 rounded-xl border border-hairline">
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">
              {b.provider?.name || "Driver"}
              {b.provider?.verified && <Star className="inline h-3 w-3 text-primary ml-1" />}
            </div>
            <div className="text-xs text-muted-foreground flex items-center gap-2">
              <span>₹{b.price_inr}</span>
              <span className="inline-flex items-center gap-0.5"><Clock className="h-3 w-3" />{b.eta_minutes} min</span>
              {b.distance_km != null && <span>{Number(b.distance_km).toFixed(1)} km away</span>}
            </div>
          </div>
          <Button size="sm" className="rounded-full h-8" onClick={() => accept(b.id)}>
            <Check className="h-3.5 w-3.5 mr-1" /> Accept
          </Button>
        </div>
      ))}
    </Card>
  );
}