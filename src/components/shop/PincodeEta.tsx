import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Truck, MapPin, Loader2 } from "lucide-react";
import { useDeliveryEta, savedPincode, savePincode } from "@/hooks/useDeliveryEta";

type Props = {
  fromPincode?: string | null;
  compact?: boolean;
  onPincodeChange?: (pin: string) => void;
};

/**
 * Pincode → ETA chip. Mimics Zomato/Swiggy's "Deliver to" feel.
 */
export const PincodeEta = ({ fromPincode, compact, onPincodeChange }: Props) => {
  const [pin, setPin] = useState(savedPincode());
  useEffect(() => {
    if (/^\d{6}$/.test(pin)) {
      savePincode(pin);
      onPincodeChange?.(pin);
    }
  }, [pin, onPincodeChange]);

  const { data, isFetching } = useDeliveryEta(pin, fromPincode);

  return (
    <div className={`flex items-center gap-2 rounded-full border border-hairline bg-card ${compact ? "px-3 py-1.5" : "px-4 py-2"}`}>
      <MapPin className="h-4 w-4 text-primary shrink-0" />
      <Input
        inputMode="numeric"
        pattern="\d{6}"
        maxLength={6}
        value={pin}
        placeholder="Pincode"
        onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
        className="h-7 w-20 border-0 bg-transparent p-0 focus-visible:ring-0 text-sm"
        aria-label="Delivery pincode"
      />
      <span className="h-4 w-px bg-hairline" />
      {!/^\d{6}$/.test(pin) ? (
        <span className="text-xs text-muted-foreground">Enter pincode for ETA</span>
      ) : isFetching ? (
        <span className="text-xs text-muted-foreground inline-flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Estimating…</span>
      ) : data ? (
        <span className="text-xs inline-flex items-center gap-1">
          <Truck className="h-3.5 w-3.5 text-emerald-600" />
          <span className="font-medium">
            {data.min_days === data.max_days ? `${data.min_days}` : `${data.min_days}–${data.max_days}`} day{data.max_days > 1 ? "s" : ""}
          </span>
          <span className="text-muted-foreground capitalize">· {data.zone}</span>
        </span>
      ) : (
        <span className="text-xs text-muted-foreground">Not serviceable</span>
      )}
    </div>
  );
};