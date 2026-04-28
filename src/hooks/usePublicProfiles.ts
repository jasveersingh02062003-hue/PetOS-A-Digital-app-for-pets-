import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type PublicProfile = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  city: string | null;
  bio: string | null;
  handle?: string | null;
  cover_url?: string | null;
  account_type?: string | null;
};

export type PublicPet = {
  id: string;
  name: string;
  avatar_url: string | null;
  species?: string | null;
  breed?: string | null;
  owner_id?: string | null;
  public_id?: string | null;
  status_chip?: string | null;
  sire_pet_id?: string | null;
  dam_pet_id?: string | null;
  date_of_birth?: string | null;
  vaccination_verified?: boolean | null;
};

/**
 * Shared cache for the get_profiles_public RPC.
 * Without this, every component (StoryRail, PostFeed, MissingStrip, ...) was
 * issuing its own SELECT against the entire profiles table on every mount.
 */
export const usePublicProfiles = () =>
  useQuery({
    queryKey: ["profiles-public"],
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_profiles_public");
      if (error) throw error;
      return (data ?? []) as PublicProfile[];
    },
  });

export const usePublicPets = () =>
  useQuery({
    queryKey: ["pets-public"],
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_pets_public" as any);
      if (error) throw error;
      return (data ?? []) as PublicPet[];
    },
  });
