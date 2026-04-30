import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type DeliveryEta = {
  min_days: number;
  max_days: number;
  zone: "local" | "regional" | "zonal" | "national" | string;
};

const PIN_RE = /^\d{6}$/;

/**
 * Pincode-based delivery ETA estimator.
 * `from` defaults to a national hub when seller pincode is unknown.
 */
export function useDeliveryEta(toPincode: string | null | undefined, fromPincode?: string | null) {
  const to = (toPincode ?? "").trim();
  const from = (fromPincode ?? "560001").trim(); // Bengaluru hub fallback
  const enabled = PIN_RE.test(to) && PIN_RE.test(from);
  return useQuery<DeliveryEta | null>({
    queryKey: ["delivery-eta", from, to],
    enabled,
    staleTime: 1000 * 60 * 60,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("estimate_delivery_days", {
        p_from: from,
        p_to: to,
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      return row ?? null;
    },
  });
}

const KEY = "petos:delivery-pincode";
export const savedPincode = () => (typeof window === "undefined" ? "" : localStorage.getItem(KEY) ?? "");
export const savePincode = (v: string) => {
  if (typeof window === "undefined") return;
  if (PIN_RE.test(v)) localStorage.setItem(KEY, v);
};