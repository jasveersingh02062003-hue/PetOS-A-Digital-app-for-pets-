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
  account_type: string | null;
  /** True when an org's branding (org name + logo) overrides the personal name. */
  is_org: boolean;
  stories: Story[];
};

const ORG_ROLES = new Set(["breeder", "kennel", "shelter", "sanctuary", "zoo"]);

export const useActiveStories = () => {
  return useQuery({
    queryKey: ["stories", "active"],
    staleTime: 2 * 60_000,
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
      const pMap = new Map(
        (profiles ?? [])
          .filter((p: any) => authorIds.includes(p.id))
          .map((p: any) => [p.id, p]),
      );
      // Pull approved org_profiles for any org-type authors so we can
      // surface org name + logo in the rail and viewer (Instagram-style).
      const { data: orgRows } = await supabase
        .from("org_profiles")
        .select("user_id, org_name, logo_url, status")
        .in("user_id", authorIds)
        .eq("status", "approved");
      const oMap = new Map((orgRows ?? []).map((o: any) => [o.user_id, o]));
      const groups = new Map<string, StoryGroup>();
      for (const s of stories as Story[]) {
        if (!groups.has(s.author_id)) {
          const p: any = pMap.get(s.author_id);
          const o: any = oMap.get(s.author_id);
          const accountType = (p?.account_type ?? null) as string | null;
          const isOrg = !!o && !!accountType && ORG_ROLES.has(accountType);
          groups.set(s.author_id, {
            author_id: s.author_id,
            author_name: isOrg ? (o.org_name as string) : (p?.full_name ?? null),
            author_avatar: isOrg ? (o.logo_url ?? p?.avatar_url ?? null) : (p?.avatar_url ?? null),
            account_type: accountType,
            is_org: isOrg,
            stories: [],
          });
        }
        groups.get(s.author_id)!.stories.push(s);
      }
      return [...groups.values()];
    },
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
  try {
    await supabase.from("story_views").insert({ story_id: storyId, viewer_id: userId });
  } catch {}
};
