import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export function PlaceBidSheet({
  open, onOpenChange, bookingId, driverProviderId, distanceKm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  bookingId: string;
  driverProviderId: string;
  distanceKm?: number | null;
}) {
  const { user } = useAuth();
  const [price, setPrice] = useState("");
  const [eta, setEta] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!user) return;
    const p = parseInt(price, 10), e = parseInt(eta, 10);
    if (!p || p <= 0) return toast.error("Enter a valid price");
    if (!e || e <= 0) return toast.error("Enter ETA in minutes");
    setSaving(true);
    const { error } = await supabase.from("taxi_bids" as any).insert({
      booking_id: bookingId,
      driver_provider_id: driverProviderId,
      driver_user_id: user.id,
      price_inr: p,
      eta_minutes: e,
      distance_km: distanceKm ?? null,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Bid placed — customer notified");
    onOpenChange(false);
    setPrice(""); setEta("");
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl">
        <SheetHeader><SheetTitle>Place your bid</SheetTitle></SheetHeader>
        <div className="space-y-3 py-3">
          <div>
            <Label className="text-xs">Your price (₹)</Label>
            <Input type="number" inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value)} className="rounded-xl mt-1" />
          </div>
          <div>
            <Label className="text-xs">ETA to pickup (minutes)</Label>
            <Input type="number" inputMode="numeric" value={eta} onChange={(e) => setEta(e.target.value)} className="rounded-xl mt-1" />
          </div>
          {distanceKm != null && (
            <p className="text-xs text-muted-foreground">{distanceKm.toFixed(1)} km from pickup</p>
          )}
          <Button onClick={submit} disabled={saving} className="w-full rounded-full">
            {saving ? "Sending…" : "Send bid"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}