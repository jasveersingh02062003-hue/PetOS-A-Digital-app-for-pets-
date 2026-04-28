import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export type GroupKind = "breed" | "city" | "interest";
export type Group = {
  id: string;
  slug: string;
  name: string;
  kind: GroupKind;
  key: string;
  description: string | null;
  cover_url: string | null;
  member_count: number;
  created_by: string | null;
};

const slugify = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

export const useAllGroups = (search?: string) =>
  useQuery({
    queryKey: ["groups", "all", search ?? ""],
    queryFn: async () => {
      let q = supabase.from("groups").select("*").order("member_count", { ascending: false }).limit(100);
      if (search && search.trim()) q = q.ilike("name", `%${search.trim()}%`);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Group[];
    },
  });

export const useMyGroups = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["groups", "mine", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("group_members")
        .select("group_id, groups(*)")
        .eq("user_id", user!.id);
      if (error) throw error;
      return (data ?? []).map((r: any) => r.groups).filter(Boolean) as Group[];
    },
  });
};

export const useSuggestedGroups = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["groups", "suggested", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const [{ data: profile }, { data: pets }, { data: mine }] = await Promise.all([
        supabase.from("profiles").select("city, interests").eq("id", user!.id).maybeSingle(),
        supabase.from("pets").select("breed").eq("owner_id", user!.id),
        supabase.from("group_members").select("group_id").eq("user_id", user!.id),
      ]);
      const myIds = new Set((mine ?? []).map((m: any) => m.group_id));
      const breedKeys = (pets ?? []).map((p: any) => p.breed).filter(Boolean).map(slugify);
      const interestKeys = (profile?.interests ?? []).map(slugify);
      const cityKey = profile?.city ? slugify(profile.city) : null;

      const { data, error } = await supabase
        .from("groups")
        .select("*")
        .or(
          [
            cityKey ? `and(kind.eq.city,key.eq.${cityKey})` : null,
            breedKeys.length ? `and(kind.eq.breed,key.in.(${breedKeys.join(",")}))` : null,
            interestKeys.length ? `and(kind.eq.interest,key.in.(${interestKeys.join(",")}))` : null,
          ].filter(Boolean).join(",") || "kind.eq.interest"
        )
        .order("member_count", { ascending: false })
        .limit(12);
      if (error) throw error;
      return ((data ?? []) as Group[]).filter((g) => !myIds.has(g.id));
    },
  });
};

export const useGroupBySlug = (slug?: string) =>
  useQuery({
    queryKey: ["group", slug],
    enabled: !!slug,
    queryFn: async () => {
      const { data, error } = await supabase.from("groups").select("*").eq("slug", slug!).maybeSingle();
      if (error) throw error;
      return data as Group | null;
    },
  });

export const useIsMember = (groupId?: string) => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["group-member", groupId, user?.id],
    enabled: !!groupId && !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("group_members")
        .select("user_id")
        .eq("group_id", groupId!)
        .eq("user_id", user!.id)
        .maybeSingle();
      return !!data;
    },
  });
};

export const useToggleMembership = () => {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ groupId, isMember }: { groupId: string; isMember: boolean }) => {
      if (!user) throw new Error("Sign in first");
      if (isMember) {
        const { error } = await supabase.from("group_members").delete().eq("group_id", groupId).eq("user_id", user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("group_members").insert({ group_id: groupId, user_id: user.id });
        if (error) throw error;
      }
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["group-member", vars.groupId] });
      qc.invalidateQueries({ queryKey: ["groups"] });
      qc.invalidateQueries({ queryKey: ["group", undefined] });
    },
    onError: (e: any) => toast.error(e.message || "Could not update membership"),
  });
};

export const useGroupPosts = (groupId?: string) =>
  useQuery({
    queryKey: ["group-posts", groupId],
    enabled: !!groupId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("group_posts")
        .select("post_id, posts(*)")
        .eq("group_id", groupId!)
        .order("added_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []).map((r: any) => r.posts).filter(Boolean);
    },
  });

export const useGroupMembers = (groupId?: string) =>
  useQuery({
    queryKey: ["group-members-list", groupId],
    enabled: !!groupId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("group_members")
        .select("user_id, role, joined_at")
        .eq("group_id", groupId!)
        .order("joined_at", { ascending: false })
        .limit(60);
      if (error) throw error;
      return data ?? [];
    },
  });
