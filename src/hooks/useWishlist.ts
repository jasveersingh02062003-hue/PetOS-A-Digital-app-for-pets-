import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export const useWishlistIds = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["wishlist-ids", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wishlists" as any)
        .select("listing_id")
        .eq("user_id", user!.id);
      if (error) throw error;
      return new Set(((data ?? []) as any[]).map((r) => r.listing_id as string));
    },
  });
};

export const useWishlistList = (userId?: string) => {
  return useQuery({
    queryKey: ["wishlist-list", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wishlists" as any)
        .select("id, created_at, listing:listing_id(id, title, photos, fee_inr, listing_type, city, seller_type)")
        .eq("user_id", userId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
};

export const useToggleWishlist = () => {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ listingId, isSaved }: { listingId: string; isSaved: boolean }) => {
      if (!user) throw new Error("Sign in to save listings");
      if (isSaved) {
        const { error } = await supabase
          .from("wishlists" as any)
          .delete()
          .eq("user_id", user.id)
          .eq("listing_id", listingId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("wishlists" as any)
          .insert({ user_id: user.id, listing_id: listingId });
        if (error) throw error;
      }
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["wishlist-ids"] });
      qc.invalidateQueries({ queryKey: ["wishlist-list"] });
      toast.success(vars.isSaved ? "Removed from wishlist" : "Saved to wishlist");
    },
    onError: (e: any) => toast.error(e.message ?? "Could not update wishlist"),
  });
};
