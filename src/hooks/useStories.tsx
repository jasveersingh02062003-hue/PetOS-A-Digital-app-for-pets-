import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export type Story = {
  id: string;
  author_id: string;
  pet_id: string | null;
  image_url: string;
  caption: string | null;
  created_at: string;
  expires_at: string;
  view_count: number;
};

export type StoryGroup = {
  author_id: string;
  author_name: string | null;
  author_avatar: string | null;
  stories: Story[];
};

export const useActiveStories = () => {
  return useQuery({
    queryKey: ["stories", "active"],
    queryFn: async (): Promise<StoryGroup[]> => {
      const { data: stories, error } = await supabase
        .from("stories")
        .select("*")
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: true });
      if (error) throw error;
      if (!stories?.length) return [];
      const authorIds = [...new Set(stories.map((s) => s.author_id))];
      const { data: profiles } = await supabase.rpc("get_profiles_public");
      const pMap = new Map((profiles ?? []).filter((p: any) => authorIds.includes(p.id)).map((p: any) => [p.id, p]));
      const groups = new Map<string, StoryGroup>();
      for (const s of stories as Story[]) {
        if (!groups.has(s.author_id)) {
          const p: any = pMap.get(s.author_id);
          groups.set(s.author_id, {
            author_id: s.author_id,
            author_name: p?.full_name ?? null,
            author_avatar: p?.avatar_url ?? null,
            stories: [],
          });
        }
        groups.get(s.author_id)!.stories.push(s);
      }
      return [...groups.values()];
    },
    refetchInterval: 60_000,
  });
};

export const useUploadStory = () => {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ file, caption, petId }: { file: File; caption?: string; petId?: string | null }) => {
      if (!user) throw new Error("Sign in");
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("stories").upload(path, file, { contentType: file.type });
      if (upErr) throw upErr;
      const { data: { publicUrl } } = supabase.storage.from("stories").getPublicUrl(path);
      const { error } = await supabase.from("stories").insert({
        author_id: user.id,
        image_url: publicUrl,
        caption: caption || null,
        pet_id: petId || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Story shared — visible for 24h");
      qc.invalidateQueries({ queryKey: ["stories", "active"] });
    },
    onError: (e: any) => toast.error(e.message || "Could not upload"),
  });
};

export const markStoryViewed = async (storyId: string, userId: string) => {
  await supabase.from("story_views").insert({ story_id: storyId, viewer_id: userId }).select().single().then(() => {}).catch(() => {});
};
