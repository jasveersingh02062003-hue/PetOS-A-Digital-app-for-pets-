import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { PawPrint } from "lucide-react";
import { toast } from "sonner";
import { haptic } from "@/lib/haptics";

/**
 * Vouch endorsement on a Skill Spotlight. One per user per spotlight.
 * Owner of the pet cannot vouch for their own spotlight (RLS blocks it).
 */
export const VouchButton = ({ spotlightId }: { spotlightId: string }) => {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: spotlight } = useQuery({
    queryKey: ["spotlight", spotlightId],
    queryFn: async () => {
      const { data } = await supabase
        .from("skill_spotlights")
        .select("id, vouch_count, crowd_favourite_at, pet_id, pets:pet_id(owner_id)")
        .eq("id", spotlightId)
        .maybeSingle();
      return data as any;
    },
  });

  const { data: mine } = useQuery({
    queryKey: ["spotlight-vouched", spotlightId, user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("skill_vouches")
        .select("id")
        .eq("spotlight_id", spotlightId)
        .eq("voucher_id", user!.id)
        .maybeSingle();
      return !!data;
    },
  });

  const isOwner = spotlight?.pets?.owner_id === user?.id;
  const count = spotlight?.vouch_count ?? 0;

  const toggle = async () => {
    if (!user) return toast.error("Please sign in to vouch");
    if (isOwner) return toast.info("You can't vouch for your own pet");
    haptic(10);
    if (mine) {
      await supabase.from("skill_vouches").delete().eq("spotlight_id", spotlightId).eq("voucher_id", user.id);
    } else {
      const { error } = await supabase.from("skill_vouches").insert({ spotlight_id: spotlightId });
      if (error) return toast.error(error.message);
      toast.success("Vouched! 🐾");
    }
    qc.invalidateQueries({ queryKey: ["spotlight", spotlightId] });
    qc.invalidateQueries({ queryKey: ["spotlight-vouched", spotlightId, user.id] });
    qc.invalidateQueries({ queryKey: ["pet-spotlights"] });
  };

  return (
    <Button
      size="sm"
      variant={mine ? "default" : "outline"}
      onClick={toggle}
      disabled={isOwner}
      className="rounded-full gap-1.5 h-8 px-3"
    >
      <PawPrint className={`h-3.5 w-3.5 ${mine ? "fill-current" : ""}`} />
      <span className="text-xs font-semibold">Vouch · {count}</span>
    </Button>
  );
};