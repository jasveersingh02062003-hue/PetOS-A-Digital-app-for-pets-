import { ReactNode, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MessageCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { CommentSheet } from "./CommentSheet";
import { ReportButton } from "./ReportButton";
import { FollowButton } from "./social/FollowButton";
import { CollabBadge } from "./social/CollabBadge";
import { SellerBadge } from "./SellerBadge";
import { useVerifiedOrgs } from "@/hooks/useVerifiedOrgs";
import { getRoleRing, isOrgRole } from "@/lib/roleTheme";
import { AuthorIdentity } from "./AuthorIdentity";
import { ReactionBar } from "./social/ReactionBar";
import { CaptionWithTags } from "./social/CaptionWithTags";
import { SaveButton } from "./social/SaveButton";
import { useBlockedIds } from "@/hooks/useBlockedIds";
import { usePawBurst } from "./social/PawBurst";
import { addReaction } from "@/lib/reactions";
import { haptic } from "@/lib/haptics";
import { usePublicProfiles } from "@/hooks/usePublicProfiles";
import { toast } from "sonner";
import { SmartImage } from "./SmartImage";
import { FeedSkeleton } from "./skeletons/FeedSkeleton";

export type FeedPost = {
  id: string;
  author_id: string;
  pet_id: string | null;
  caption: string | null;
  image_url: string | null;
  image_url_thumb?: string | null;
  image_url_feed?: string | null;
  image_url_full?: string | null;
  like_count: number;
  comment_count: number;
  created_at: string;
  reaction_counts?: Record<string, number> | null;
  author?: { full_name: string | null; avatar_url: string | null; account_type?: string | null } | null;
  pet?: { name: string; avatar_url: string | null } | null;
};

export const PostFeed = ({ scope = "all", emptyState }: { scope?: "all" | "trending" | "following"; emptyState?: ReactNode }) => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [commentsFor, setCommentsFor] = useState<string | null>(null);
  const { data: blocked } = useBlockedIds();
  const { data: publicProfiles } = usePublicProfiles();

  const { data, isLoading } = useQuery({
    queryKey: ["feed", scope, user?.id ?? null, blocked?.size ?? 0],
    enabled: publicProfiles !== undefined,
    queryFn: async () => {
      let followingIds: string[] | null = null;
      if (scope === "following") {
        if (!user) return [];
        const { data: f } = await supabase.from("follows").select("following_id").eq("follower_id", user.id);
        followingIds = (f ?? []).map((r: any) => r.following_id);
        if (!followingIds.length) return [];
      }
      let q = supabase.from("posts").select("id, author_id, pet_id, caption, image_url, image_url_thumb, image_url_feed, image_url_full, like_count, comment_count, created_at, reaction_counts");
      if (followingIds) q = q.in("author_id", followingIds);
      q = scope === "trending"
        ? q.order("like_count", { ascending: false }).order("created_at", { ascending: false }).limit(50)
        : q.order("created_at", { ascending: false }).limit(50);
      const { data: postsRaw, error } = await q;
      if (error) throw error;
      const posts = (postsRaw ?? []).filter((p) => !blocked || !blocked.has(p.author_id));
      if (!posts?.length) return [];

      const petIds = [...new Set(posts.map((p) => p.pet_id).filter(Boolean) as string[])];
      // Profiles come from the shared cache — no per-feed RPC.
      const pMap = new Map((publicProfiles ?? []).map((p) => [p.id, p]));
      const { data: pets } = petIds.length
        ? await supabase.from("pets").select("id, name, avatar_url").in("id", petIds)
        : { data: [] as any[] };
      const petMap = new Map((pets ?? []).map((p: any) => [p.id, p]));
      return posts.map((p) => ({
        ...p,
        author: pMap.get(p.author_id) ?? null,
        pet: p.pet_id ? petMap.get(p.pet_id) ?? null : null,
      })) as FeedPost[];
    },
  });

  // Realtime — scope to this feed key so we don't refetch both tabs on every insert.
  useEffect(() => {
    const ch = supabase
      .channel(`feed-posts:${scope}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "posts" }, () => {
        qc.invalidateQueries({ queryKey: ["feed", scope] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc, scope]);

  if (isLoading) {
    return <FeedSkeleton count={3} />;
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
            onComment={() => setCommentsFor(post.id)}
          />
        ))}
      </div>
      <CommentSheet postId={commentsFor} onOpenChange={(open) => !open && setCommentsFor(null)} />
    </>
  );
};

const PostCard = ({ post, onComment }: {
  post: FeedPost; onComment: () => void;
}) => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: verifiedOrgs } = useVerifiedOrgs();
  const authorVerified = !!(post.author_id && verifiedOrgs?.has(post.author_id));
  const accountType = post.author?.account_type ?? "pet_parent";
  const orgPost = isOrgRole(accountType) && !post.pet_id;
  const displayName = post.pet?.name || post.author?.full_name || "Pet parent";
  const displayImg = post.pet?.avatar_url || post.author?.avatar_url || undefined;
  const initial = displayName[0]?.toUpperCase() || "P";
  const { burst, node: pawLayer } = usePawBurst();
  const lastTapRef = useRef<{ t: number; x: number; y: number } | null>(null);

  const handleImageTap = async (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    let cx: number, cy: number;
    if ("touches" in e || "changedTouches" in e) {
      const t = (e as React.TouchEvent).changedTouches?.[0] ?? (e as React.TouchEvent).touches?.[0];
      if (!t) return;
      cx = t.clientX - rect.left;
      cy = t.clientY - rect.top;
    } else {
      cx = (e as React.MouseEvent).clientX - rect.left;
      cy = (e as React.MouseEvent).clientY - rect.top;
    }
    const now = Date.now();
    const last = lastTapRef.current;
    const isDouble =
      last &&
      now - last.t < 320 &&
      Math.abs(cx - last.x) < 24 &&
      Math.abs(cy - last.y) < 24;
    if (isDouble) {
      lastTapRef.current = null;
      burst(cx, cy);
      haptic(15);
      if (!user) {
        toast.message("Sign in to react");
        return;
      }
      try {
        const inserted = await addReaction(post.id, user.id, "love");
        if (inserted) {
          qc.invalidateQueries({ queryKey: ["post-reactions-counts", post.id] });
          qc.invalidateQueries({ queryKey: ["post-reactions-mine", post.id] });
        }
      } catch {
        // silent — animation already gave feedback
      }
    } else {
      lastTapRef.current = { t: now, x: cx, y: cy };
    }
  };

  return (
    <Card className="rounded-2xl border-hairline bg-card shadow-none overflow-hidden">
      <div className="flex items-center gap-3 p-4">
        {orgPost ? (
          <div className="flex-1 min-w-0">
            <AuthorIdentity
              userId={post.author_id}
              fallbackName={post.author?.full_name}
              fallbackAvatar={post.author?.avatar_url}
              fallbackAccountType={accountType}
              size="md"
              subline={
                <span className="text-[11px] text-muted-foreground">
                  {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                </span>
              }
            />
            <CollabBadge postId={post.id} />
          </div>
        ) : (
          <>
        <Link to={`/u/${post.author_id}`} className="shrink-0">
          <Avatar
            className={`h-9 w-9 ring-2 ring-offset-2 ring-offset-background ${getRoleRing(accountType)}`}
          >
            <AvatarImage src={displayImg} alt={displayName} />
            <AvatarFallback className="bg-primary-soft text-primary text-sm font-medium">{initial}</AvatarFallback>
          </Avatar>
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <Link to={post.pet_id ? `/pet/${post.pet_id}` : `/u/${post.author_id}`} className="text-sm font-medium truncate hover:underline">
              {displayName}
            </Link>
            {accountType !== "pet_parent" && (
              <SellerBadge type={accountType as any} verified={authorVerified} />
            )}
          </div>
          <div className="text-[11px] text-muted-foreground">
            {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
          </div>
          <CollabBadge postId={post.id} />
        </div>
          </>
        )}
        <FollowButton targetId={post.author_id} />
      </div>

      {(post.image_url_feed || post.image_url) && (
        <div
          className="relative select-none"
          onClick={handleImageTap}
          onDoubleClick={(e) => e.preventDefault()}
        >
          <SmartImage
            variant="feed"
            src={post.image_url}
            variants={{
              thumb: post.image_url_thumb,
              feed: post.image_url_feed,
              full: post.image_url_full,
            }}
            aspect="1/1"
            alt=""
          />
          {pawLayer}
        </div>
      )}

      {post.caption && (
        <CaptionWithTags
          text={post.caption}
          className="px-4 pt-3 text-sm leading-relaxed text-foreground whitespace-pre-wrap"
        />
      )}

      <div className="flex items-center gap-1 px-2 py-2">
        <ReactionBar postId={post.id} initialCounts={post.reaction_counts ?? {}} />
        <button
          onClick={onComment}
          className="flex items-center gap-1.5 px-3 py-2 rounded-full hover:bg-muted/60 transition-colors active:scale-110"
          aria-label="Comment"
        >
          <MessageCircle className="h-5 w-5" strokeWidth={1.6} />
          <span className="text-sm tabular-nums">{post.comment_count}</span>
        </button>
        <SaveButton postId={post.id} />
        <div className="ml-auto pr-1">
          <ReportButton subjectType="post" subjectId={post.id} size="icon" />
        </div>
      </div>
    </Card>
  );
};

