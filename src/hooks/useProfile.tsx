import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export const useProfile = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").eq("id", user!.id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
};

export const usePets = (ownerId?: string) => {
  const { user } = useAuth();
  const id = ownerId ?? user?.id;
  return useQuery({
    queryKey: ["pets", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from("pets").select("*").eq("owner_id", id!).order("created_at");
      if (error) throw error;
      return data;
    },
  });
};
