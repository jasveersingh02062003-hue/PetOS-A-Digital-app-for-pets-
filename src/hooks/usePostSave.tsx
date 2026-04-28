import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export const useIsSaved = (postId: string) => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["post-save", postId, user?.id ?? null],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("post_saves" as any)
        .select("post_id")
        .eq("post_id", postId)
        .eq("user_id", user!.id)
        .maybeSingle();
      return !!data;
    },
  });
};

export const useToggleSave = () => {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ postId, saved }: { postId: string; saved: boolean }) => {
      if (!user) throw new Error("Sign in to save");
      if (saved) {
        const { error } = await supabase.from("post_saves" as any).delete().eq("post_id", postId).eq("user_id", user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("post_saves" as any).insert({ post_id: postId, user_id: user.id });
        if (error) throw error;
      }
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["post-save", vars.postId] });
      qc.invalidateQueries({ queryKey: ["saved-posts"] });
    },
  });
};

export const useSavedPosts = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["saved-posts", user?.id ?? null],
    enabled: !!user,
    queryFn: async () => {
      const { data: saves } = await supabase
        .from("post_saves" as any)
        .select("post_id, created_at")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      const ids = (saves ?? []).map((s: any) => s.post_id);
      if (!ids.length) return [];
      const { data: posts } = await supabase
        .from("posts")
        .select("id, author_id, pet_id, caption, image_url, like_count, comment_count, created_at, reaction_counts")
        .in("id", ids);
      return posts ?? [];
    },
  });
};
