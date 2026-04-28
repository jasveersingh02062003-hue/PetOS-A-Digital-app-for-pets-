import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export const useInviteCollaborators = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ postId, userIds }: { postId: string; userIds: string[] }) => {
      if (!userIds.length) return;
      const rows = userIds.map((uid) => ({ post_id: postId, user_id: uid, status: "pending" as const }));
      const { error } = await supabase.from("post_collaborators").insert(rows);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["collabs"] }),
    onError: (e: any) => toast.error(e.message ?? "Could not invite"),
  });
};

export const usePendingCollabInvites = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["collabs", "pending", user?.id ?? null],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("post_collaborators")
        .select("*, posts(id, caption, image_url, author_id, created_at)")
        .eq("user_id", user!.id)
        .eq("status", "pending")
        .order("invited_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
};

export const useRespondCollab = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ postId, accept }: { postId: string; accept: boolean }) => {
      const { error } = await supabase
        .from("post_collaborators")
        .update({ status: accept ? "accepted" : "declined" })
        .eq("post_id", postId);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["collabs"] });
      qc.invalidateQueries({ queryKey: ["post-grid"] });
      toast.success(vars.accept ? "Collab accepted" : "Declined");
    },
    onError: (e: any) => toast.error(e.message ?? "Could not respond"),
  });
};

export const usePostCollaborators = (postId: string | null | undefined) => {
  return useQuery({
    queryKey: ["collabs", "post", postId],
    enabled: !!postId,
    queryFn: async () => {
      const { data: rows } = await supabase
        .from("post_collaborators")
        .select("*")
        .eq("post_id", postId!)
        .eq("status", "accepted");
      if (!rows?.length) return [];
      const ids = rows.map((r: any) => r.user_id);
      const { data: profiles } = await supabase.rpc("get_profiles_public");
      const map = new Map((profiles ?? []).map((p: any) => [p.id, p]));
      return rows.map((r: any) => ({ ...r, profile: map.get(r.user_id) }));
    },
  });
};

export const useUserCollabPostIds = (userId: string | null | undefined) => {
  return useQuery({
    queryKey: ["collabs", "user-posts", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("post_collaborators")
        .select("post_id")
        .eq("user_id", userId!)
        .eq("status", "accepted");
      if (error) throw error;
      return (data ?? []).map((r: any) => r.post_id);
    },
  });
};
