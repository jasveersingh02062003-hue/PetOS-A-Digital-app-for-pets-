import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export type RsvpStatus = "going" | "maybe" | "declined";

export type Meetup = {
  id: string;
  host_id: string;
  group_id: string | null;
  title: string;
  description: string | null;
  city: string | null;
  venue: string | null;
  starts_at: string;
  capacity: number | null;
  cover_url: string | null;
  status: "upcoming" | "cancelled" | "done";
  attending_count: number;
  lat: number | null;
  lng: number | null;
};

export const useUpcomingMeetups = (city?: string | null) =>
  useQuery({
    queryKey: ["meetups", "upcoming", city ?? ""],
    queryFn: async () => {
      let q = supabase
        .from("meetups")
        .select("*")
        .eq("status", "upcoming")
        .gte("starts_at", new Date().toISOString())
        .order("starts_at", { ascending: true })
        .limit(40);
      if (city) q = q.ilike("city", city);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Meetup[];
    },
  });

export const useMeetup = (id?: string) =>
  useQuery({
    queryKey: ["meetup", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from("meetups").select("*").eq("id", id!).maybeSingle();
      if (error) throw error;
      return data as Meetup | null;
    },
  });

export const useMeetupRsvps = (meetupId?: string) =>
  useQuery({
    queryKey: ["meetup-rsvps", meetupId],
    enabled: !!meetupId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meetup_rsvps")
        .select("user_id, pet_id, status, created_at")
        .eq("meetup_id", meetupId!)
        .eq("status", "going")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

export const useMyRsvp = (meetupId?: string) => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["my-rsvp", meetupId, user?.id],
    enabled: !!meetupId && !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("meetup_rsvps")
        .select("status, pet_id")
        .eq("meetup_id", meetupId!)
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
  });
};

export const useSetRsvp = () => {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ meetupId, status, petId }: { meetupId: string; status: RsvpStatus; petId?: string | null }) => {
      if (!user) throw new Error("Sign in first");
      const { error } = await supabase
        .from("meetup_rsvps")
        .upsert({ meetup_id: meetupId, user_id: user.id, status, pet_id: petId ?? null }, { onConflict: "meetup_id,user_id" });
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["my-rsvp", vars.meetupId] });
      qc.invalidateQueries({ queryKey: ["meetup-rsvps", vars.meetupId] });
      qc.invalidateQueries({ queryKey: ["meetup", vars.meetupId] });
      qc.invalidateQueries({ queryKey: ["meetups"] });
    },
    onError: (e: any) => toast.error(e.message || "Could not update RSVP"),
  });
};

export const useCreateMeetup = () => {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (m: Partial<Meetup> & { title: string; starts_at: string }) => {
      if (!user) throw new Error("Sign in first");
      const { data, error } = await supabase
        .from("meetups")
        .insert({ ...m, host_id: user.id } as any)
        .select("*")
        .single();
      if (error) throw error;
      return data as Meetup;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["meetups"] });
      toast.success("Meetup created");
    },
    onError: (e: any) => toast.error(e.message || "Could not create meetup"),
  });
};
