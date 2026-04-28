import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ImageIcon } from "lucide-react";

export const PostGrid = ({
  authorId,
  petId,
  includeCollabs = false,
}: {
  authorId?: string;
  petId?: string;
  includeCollabs?: boolean;
}) => {
  const { data, isLoading } = useQuery({
    queryKey: ["post-grid", authorId ?? null, petId ?? null, includeCollabs],
    queryFn: async () => {
      let collabPostIds: string[] = [];
      if (includeCollabs && authorId) {
        const { data: rows } = await supabase
          .from("post_collaborators")
          .select("post_id")
          .eq("user_id", authorId)
          .eq("status", "accepted");
        collabPostIds = (rows ?? []).map((r: any) => r.post_id);
      }

      let q = supabase
        .from("posts")
        .select("id, image_url, caption, like_count, author_id")
        .not("image_url", "is", null)
        .order("created_at", { ascending: false })
        .limit(60);

      if (petId) q = q.eq("pet_id", petId);
      else if (authorId) {
        if (collabPostIds.length) {
          // own posts OR collab posts
          q = q.or(`author_id.eq.${authorId},id.in.(${collabPostIds.join(",")})`);
        } else {
          q = q.eq("author_id", authorId);
        }
      }
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  if (isLoading)
    return (
      <div className="grid grid-cols-3 gap-1">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="aspect-square bg-muted animate-pulse" />
        ))}
      </div>
    );
  if (!data?.length)
    return (
      <div className="text-center py-12 text-sm text-muted-foreground">
        <ImageIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
        No photos yet
      </div>
    );

  return (
    <div className="grid grid-cols-3 gap-0.5">
      {data.map((p: any) => (
        <div key={p.id} className="aspect-square bg-muted overflow-hidden relative">
          <img src={p.image_url} alt={p.caption ?? ""} className="w-full h-full object-cover" loading="lazy" />
          {authorId && p.author_id !== authorId && (
            <div className="absolute top-1 right-1 bg-background/80 text-[9px] font-semibold px-1.5 py-0.5 rounded-full">
              COLLAB
            </div>
          )}
        </div>
      ))}
    </div>
  );
};
