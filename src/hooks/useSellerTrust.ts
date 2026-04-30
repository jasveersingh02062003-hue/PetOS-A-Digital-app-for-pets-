import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type SellerTrust = {
  verified: boolean;
  account_type?: string | null;
  member_since?: string | null;
  response_minutes?: number | null;
  completed_bookings?: number;
  completed_orders?: number;
  org?: { org_type?: string; status?: string; org_name?: string } | null;
};

/** Public, anon-callable: aggregates verified status, response time, member-since, and tx counts. */
export function useSellerTrust(userId?: string | null) {
  const [data, setData] = useState<SellerTrust | null>(null);
  const [loading, setLoading] = useState(false);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    setLoading(true);
    (async () => {
      const { data, error } = await supabase.rpc("seller_trust" as any, { _user_id: userId });
      if (!active) return;
      setLoading(false);
      if (error) { setData(null); return; }
      setData((data as SellerTrust) ?? null);
    })();
    return () => { active = false; };
  }, [userId, version]);

  // Live update: refetch when a new review for this seller is inserted.
  useEffect(() => {
    if (!userId) return;
    const ch = supabase
      .channel(`trust:${userId}`)
      .on(
        "postgres_changes" as any,
        { event: "INSERT", schema: "public", table: "reviews", filter: `subject_user_id=eq.${userId}` },
        () => setVersion((v) => v + 1),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [userId]);

  return { trust: data, loading };
}