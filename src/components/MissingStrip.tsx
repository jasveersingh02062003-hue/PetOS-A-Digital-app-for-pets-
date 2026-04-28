import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { AlertTriangle, ChevronRight } from "lucide-react";

/**
 * Horizontal strip on Home showing active local missing-pet alerts.
 * Hidden when there are none — silence is the right default.
 */
export const MissingStrip = () => {
  const nav = useNavigate();
  const { data: profile } = useProfile();
  const userCity = profile?.city;

  const { data: items } = useQuery({
    queryKey: ["missing-strip", userCity],
    enabled: !!userCity,
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("missing_pets")
        .select("id, pet_id, photo_url, last_seen_city")
        .eq("status", "active")
        .ilike("last_seen_city", userCity!)
        .order("created_at", { ascending: false })
        .limit(10);
      if (!data?.length) return [];
      const { data: pets } = await supabase.rpc("get_pets_public");
      const map = Object.fromEntries((pets ?? []).map((p: any) => [p.id, p]));
      return data.map((m: any) => ({ ...m, pet: map[m.pet_id] }));
    },
  });

  if (!items || items.length === 0) return null;

  return (
    <button
      type="button"
      onClick={() => nav("/missing")}
      className="w-full text-left rounded-2xl border border-destructive/20 bg-destructive/5 p-4 flex items-center gap-3 hover:bg-destructive/10 transition-colors"
    >
      <div className="h-10 w-10 rounded-full bg-destructive/15 flex items-center justify-center shrink-0">
        <AlertTriangle className="h-4 w-4 text-destructive" strokeWidth={1.8} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm">
          {items.length === 1 ? `${items[0].pet?.name ?? "A pet"} is missing in ${userCity}` : `${items.length} pets missing in ${userCity}`}
        </div>
        <div className="text-xs text-muted-foreground mt-0.5">Tap to help — every pair of eyes counts.</div>
      </div>
      <div className="flex -space-x-2 shrink-0">
        {items.slice(0, 3).map((m: any) => (
          <div key={m.id} className="h-8 w-8 rounded-full ring-2 ring-background bg-muted overflow-hidden">
            {m.photo_url ? <img src={m.photo_url} alt="" className="h-full w-full object-cover" /> : null}
          </div>
        ))}
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
    </button>
  );
};
