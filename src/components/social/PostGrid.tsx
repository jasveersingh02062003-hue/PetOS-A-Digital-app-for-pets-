import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ImageIcon } from "lucide-react";

export const PostGrid = ({ authorId, petId }: { authorId?: string; petId?: string }) => {
  const { data, isLoading } = useQuery({
    queryKey: ["post-grid", authorId ?? null, petId ?? null],
    queryFn: async () => {
      let q = supabase.from("posts").select("id, image_url, caption, like_count").not("image_url", "is", null).order("created_at", { ascending: false }).limit(60);
      if (authorId) q = q.eq("author_id", authorId);
      if (petId) q = q.eq("pet_id", petId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  if (isLoading) return <div className="grid grid-cols-3 gap-1">{Array.from({ length: 9 }).map((_, i) => <div key={i} className="aspect-square bg-muted animate-pulse" />)}</div>;
  if (!data?.length) return (
    <div className="text-center py-12 text-sm text-muted-foreground">
      <ImageIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
      No photos yet
    </div>
  );

  return (
    <div className="grid grid-cols-3 gap-0.5">
      {data.map((p: any) => (
        <div key={p.id} className="aspect-square bg-muted overflow-hidden">
          <img src={p.image_url} alt={p.caption ?? ""} className="w-full h-full object-cover" loading="lazy" />
        </div>
      ))}
    </div>
  );
};
