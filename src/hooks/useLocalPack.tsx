import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";

export const useLocalPack = (limit = 12) => {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const city = profile?.city;
  return useQuery({
    queryKey: ["local-pack", city, user?.id],
    enabled: !!city,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_pets_public");
      if (error) throw error;
      const list = (data ?? []) as any[];
      return list
        .filter((p) => p.city && p.city.toLowerCase() === city!.toLowerCase() && p.owner_id !== user?.id)
        .slice(0, limit);
    },
  });
};
