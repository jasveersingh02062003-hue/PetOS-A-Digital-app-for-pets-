import { ReactNode, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MessageCircle, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { CommentSheet } from "./CommentSheet";
import { ReportButton } from "./ReportButton";
import { FollowButton } from "./social/FollowButton";
import { CollabBadge } from "./social/CollabBadge";
import { ReactionBar } from "./social/ReactionBar";
import { CaptionWithTags } from "./social/CaptionWithTags";

export type FeedPost = {
  id: string;
  author_id: string;
  pet_id: string | null;
  caption: string | null;
  image_url: string | null;
  like_count: number;
  comment_count: number;
  created_at: string;
  author?: { full_name: string | null; avatar_url: string | null } | null;
  pet?: { name: string; avatar_url: string | null } | null;
};

export const PostFeed = ({ scope = "all", emptyState }: { scope?: "all" | "trending" | "following"; emptyState?: ReactNode }) => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [commentsFor, setCommentsFor] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["feed", scope, user?.id ?? null],
    queryFn: async () => {
      let followingIds: string[] | null = null;
      if (scope === "following") {
        if (!user) return [];
        const { data: f } = await supabase.from("follows").select("following_id").eq("follower_id", user.id);
        followingIds = (f ?? []).map((r: any) => r.following_id);
        if (!followingIds.length) return [];
      }
      let q = supabase.from("posts").select("*");
      if (followingIds) q = q.in("author_id", followingIds);
      q = scope === "trending"
        ? q.order("like_count", { ascending: false }).order("created_at", { ascending: false }).limit(50)
        : q.order("created_at", { ascending: false }).limit(50);
      const { data: posts, error } = await q;
      if (error) throw error;
      if (!posts?.length) return [];

      const authorIds = [...new Set(posts.map((p) => p.author_id))];
      const petIds = [...new Set(posts.map((p) => p.pet_id).filter(Boolean) as string[])];
      const [{ data: profiles }, { data: pets }] = await Promise.all([
        supabase.rpc("get_profiles_public").then((r) => ({
          data: (r.data ?? []).filter((p: any) => authorIds.includes(p.id)),
        })),
        petIds.length ? supabase.from("pets").select("id, name, avatar_url").in("id", petIds) : Promise.resolve({ data: [] as any[] }),
      ]);
      const pMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));
      const petMap = new Map((pets ?? []).map((p: any) => [p.id, p]));
      return posts.map((p) => ({
        ...p,
        author: pMap.get(p.author_id) ?? null,
        pet: p.pet_id ? petMap.get(p.pet_id) ?? null : null,
      })) as FeedPost[];
    },
  });

  const { data: myLikes } = useQuery({
    queryKey: ["my-likes", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase.from("post_likes").select("post_id").eq("user_id", user!.id);
      if (error) throw error;
      return new Set((data ?? []).map((r) => r.post_id));
    },
  });

  // Realtime
  useEffect(() => {
    const ch = supabase
      .channel("feed-posts")
      .on("postgres_changes", { event: "*", schema: "public", table: "posts" }, () => {
        qc.invalidateQueries({ queryKey: ["feed"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "post_likes" }, () => {
        qc.invalidateQueries({ queryKey: ["feed"] });
        qc.invalidateQueries({ queryKey: ["my-likes"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const toggleLike = async (post: FeedPost) => {
    if (!user) return toast.error("Please sign in");
    const liked = myLikes?.has(post.id);
    if (liked) {
      const { error } = await supabase.from("post_likes").delete().eq("post_id", post.id).eq("user_id", user.id);
      if (error) toast.error(error.message);
    } else {
      const { error } = await supabase.from("post_likes").insert({ post_id: post.id, user_id: user.id });
      if (error) toast.error(error.message);
    }
  };

  if (isLoading) {
    return <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;
  }
  if (!data?.length) {
    if (emptyState) return <>{emptyState}</>;
    return (
      <Card className="rounded-2xl border-hairline bg-card shadow-none p-8 text-center">
        <div className="font-display text-lg">Nothing here yet</div>
        <p className="text-sm text-muted-foreground mt-1">Be the first to share a moment.</p>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {data.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            liked={myLikes?.has(post.id) ?? false}
            onLike={() => toggleLike(post)}
            onComment={() => setCommentsFor(post.id)}
          />
        ))}
      </div>
      <CommentSheet postId={commentsFor} onOpenChange={(open) => !open && setCommentsFor(null)} />
    </>
  );
};

const PostCard = ({ post, liked, onLike, onComment }: {
  post: FeedPost; liked: boolean; onLike: () => void; onComment: () => void;
}) => {
  const displayName = post.pet?.name || post.author?.full_name || "Pet parent";
  const displayImg = post.pet?.avatar_url || post.author?.avatar_url || undefined;
  const initial = displayName[0]?.toUpperCase() || "P";

  return (
    <Card className="rounded-2xl border-hairline bg-card shadow-none overflow-hidden">
      <div className="flex items-center gap-3 p-4">
        <Link to={`/u/${post.author_id}`} className="shrink-0">
          <Avatar className="h-9 w-9">
            <AvatarImage src={displayImg} alt={displayName} />
            <AvatarFallback className="bg-primary-soft text-primary text-sm font-medium">{initial}</AvatarFallback>
          </Avatar>
        </Link>
        <div className="min-w-0 flex-1">
          <Link to={post.pet_id ? `/pet/${post.pet_id}` : `/u/${post.author_id}`} className="text-sm font-medium truncate block hover:underline">
            {displayName}
          </Link>
          <div className="text-[11px] text-muted-foreground">
            {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
          </div>
          <CollabBadge postId={post.id} />
        </div>
        <FollowButton targetId={post.author_id} />
      </div>

      {post.image_url && (
        <div className="bg-muted aspect-square overflow-hidden">
          <img src={post.image_url} alt="" className="w-full h-full object-cover" loading="lazy" />
        </div>
      )}

      {post.caption && (
        <p className="px-4 pt-3 text-sm leading-relaxed text-foreground whitespace-pre-wrap">{post.caption}</p>
      )}

      <div className="flex items-center gap-1 px-2 py-2">
        <button
          onClick={onLike}
          className="flex items-center gap-1.5 px-3 py-2 rounded-full hover:bg-muted/60 transition-colors"
          aria-label="Like"
        >
          <Heart className={`h-5 w-5 transition-all ${liked ? "fill-destructive text-destructive scale-110" : "text-foreground"}`} strokeWidth={1.6} />
          <span className="text-sm tabular-nums">{post.like_count}</span>
        </button>
        <button
          onClick={onComment}
          className="flex items-center gap-1.5 px-3 py-2 rounded-full hover:bg-muted/60 transition-colors"
          aria-label="Comment"
        >
          <MessageCircle className="h-5 w-5" strokeWidth={1.6} />
          <span className="text-sm tabular-nums">{post.comment_count}</span>
        </button>
        <div className="ml-auto pr-1">
          <ReportButton subjectType="post" subjectId={post.id} size="icon" />
        </div>
      </div>
    </Card>
  );
};
