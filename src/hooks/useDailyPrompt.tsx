import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export const useTodaysPrompt = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["daily-prompt", "today", user?.id ?? null],
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const { data: prompt } = await supabase
        .from("daily_prompts")
        .select("*")
        .eq("prompt_date", today)
        .maybeSingle();
      if (!prompt) return { prompt: null, myMoment: null, streak: null };

      const [myRes, streakRes] = await Promise.all([
        user
          ? supabase
              .from("daily_moments")
              .select("*")
              .eq("prompt_id", prompt.id)
              .eq("user_id", user.id)
              .maybeSingle()
          : Promise.resolve({ data: null }),
        user
          ? supabase
              .from("daily_streaks")
              .select("*")
              .eq("user_id", user.id)
              .maybeSingle()
          : Promise.resolve({ data: null }),
      ]);

      return {
        prompt,
        myMoment: myRes.data,
        streak: streakRes.data,
      };
    },
  });
};

export const useTodaysMoments = (promptId: string | null | undefined, hasPosted: boolean) => {
  return useQuery({
    queryKey: ["daily-moments", promptId, hasPosted],
    enabled: !!promptId && hasPosted,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("daily_moments")
        .select("*, posts(id, image_url, caption, like_count, comment_count, author_id, pet_id)")
        .eq("prompt_id", promptId!)
        .order("posted_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });
};

export const useLinkMoment = () => {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ promptId, postId }: { promptId: string; postId: string }) => {
      if (!user) throw new Error("Not signed in");
      const { error } = await supabase.from("daily_moments").insert({
        prompt_id: promptId,
        post_id: postId,
        user_id: user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["daily-prompt"] });
      qc.invalidateQueries({ queryKey: ["daily-moments"] });
      toast.success("Moment captured! Streak +1");
    },
    onError: (e: any) => toast.error(e.message ?? "Could not link moment"),
  });
};

export const useStreakLeaderboard = () => {
  return useQuery({
    queryKey: ["daily-streak-board"],
    queryFn: async () => {
      const { data: streaks } = await supabase
        .from("daily_streaks")
        .select("user_id, current_streak, longest_streak")
        .order("current_streak", { ascending: false })
        .limit(20);
      if (!streaks?.length) return [];
      const ids = streaks.map((s: any) => s.user_id);
      const { data: profiles } = await supabase.rpc("get_profiles_public");
      const map = new Map((profiles ?? []).map((p: any) => [p.id, p]));
      return streaks.map((s: any) => ({ ...s, profile: map.get(s.user_id) }));
    },
  });
};
