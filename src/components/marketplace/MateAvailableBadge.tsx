import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Heart } from "lucide-react";

/**
 * Small "Available for Mating" pill shown on a pet header when an active
 * mate_listings row exists for the pet. Tapping jumps to the listing.
 */
export const MateAvailableBadge = ({ petId }: { petId: string }) => {
  const nav = useNavigate();
  const { data } = useQuery({
    queryKey: ["mate-active-for-pet", petId],
    queryFn: async () => {
      const { data } = await supabase
        .from("mate_listings")
        .select("id")
        .eq("pet_id", petId)
        .eq("active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data as { id: string } | null;
    },
  });
  if (!data) return null;
  return (
    <button
      onClick={(e) => { e.stopPropagation(); nav(`/mates/${data.id}`); }}
      className="inline-flex items-center gap-1 rounded-full bg-coral/15 text-coral px-2.5 py-1 text-[11px] font-semibold border border-coral/30 hover:bg-coral/25 transition"
    >
      <Heart className="h-3 w-3" fill="currentColor" /> Available for Mating
    </button>
  );
};