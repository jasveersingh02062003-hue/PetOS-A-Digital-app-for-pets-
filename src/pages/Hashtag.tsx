import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Hash, Loader2 } from "lucide-react";

const Hashtag = () => {
  const { tag = "" } = useParams<{ tag: string }>();
  const nav = useNavigate();
  const lc = tag.toLowerCase();

  const { data, isLoading } = useQuery({
    queryKey: ["tag-feed", lc],
    queryFn: async () => {
      const { data: links, error } = await supabase
        .from("post_hashtags")
        .select("post_id")
        .eq("tag", lc)
        .order("created_at", { ascending: false })
        .limit(60);
      if (error) throw error;
      const ids = (links ?? []).map((r: any) => r.post_id);
      if (!ids.length) return [];
      const { data: posts } = await supabase
        .from("posts")
        .select("id, image_url, caption, like_count, author_id")
        .in("id", ids);
      // Preserve order from the index
      const map = new Map((posts ?? []).map((p: any) => [p.id, p]));
      return ids.map((id) => map.get(id)).filter(Boolean) as any[];
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="container-app pad-top-safe pt-4 pb-3 flex items-center gap-3 border-b border-hairline">
        <Button variant="ghost" size="icon" onClick={() => nav(-1)} className="rounded-full">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-2 min-w-0">
          <Hash className="h-5 w-5 text-primary shrink-0" />
          <div className="font-display text-xl truncate">{lc}</div>
        </div>
      </header>

      <div className="container-app py-5">
        {isLoading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
        ) : !data?.length ? (
          <Card className="rounded-2xl border-hairline bg-card shadow-none p-8 text-center">
            <div className="font-display text-lg">No posts yet</div>
            <p className="text-sm text-muted-foreground mt-1">Be the first to use #{lc}.</p>
          </Card>
        ) : (
          <>
            <p className="text-sm text-muted-foreground mb-4">{data.length} posts</p>
            <div className="grid grid-cols-3 gap-1">
              {data.map((p: any) => (
                <Link key={p.id} to={`/`} className="aspect-square bg-muted rounded-md overflow-hidden">
                  {p.image_url ? (
                    <img src={p.image_url} alt={p.caption ?? ""} className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <div className="p-2 text-[10px] text-muted-foreground line-clamp-6">{p.caption}</div>
                  )}
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Hashtag;
