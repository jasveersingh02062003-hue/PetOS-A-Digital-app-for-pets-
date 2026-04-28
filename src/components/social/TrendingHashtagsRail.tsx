import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Hash, Flame } from "lucide-react";

export const TrendingHashtagsRail = () => {
  const { data } = useQuery({
    queryKey: ["trending-hashtags"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("trending_hashtags").select("*").limit(10);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 5 * 60 * 1000,
  });

  if (!data?.length) return null;

  return (
    <div className="mb-5">
      <div className="flex items-center gap-1.5 mb-2">
        <Flame className="h-4 w-4 text-primary" />
        <h2 className="font-display text-sm">Trending tags</h2>
      </div>
      <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-1 scrollbar-none">
        {data.map((t: any) => (
          <Link
            key={t.tag}
            to={`/t/${t.tag}`}
            className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-full border border-hairline bg-card text-sm hover:border-primary/40 transition-colors"
          >
            <Hash className="h-3 w-3 text-primary" />
            <span>{t.tag}</span>
            <span className="text-[10px] text-muted-foreground tabular-nums">{t.post_count}</span>
          </Link>
        ))}
      </div>
    </div>
  );
};
