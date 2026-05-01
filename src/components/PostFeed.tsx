import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MessageCircle, Share2, MoreHorizontal, Pencil, Trash2, Pin, Loader2, Check } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import { CommentSheet } from "./CommentSheet";
import { ReportButton } from "./ReportButton";
import { FollowButton } from "./social/FollowButton";
import { CollabBadge } from "./social/CollabBadge";
import { SellerBadge } from "./SellerBadge";
import { useVerifiedOrgs, usePendingOrgs } from "@/hooks/useVerifiedOrgs";
import { getRoleRing, isOrgRole } from "@/lib/roleTheme";
import { AuthorIdentity } from "./AuthorIdentity";
import { ReactionBar } from "./social/ReactionBar";
import { CaptionWithTags } from "./social/CaptionWithTags";
import { SaveButton } from "./social/SaveButton";
import { UserStreakChip } from "./social/UserStreakChip";
import { PetPostHeader } from "./social/PetPostHeader";
import { PostTrustStrip } from "./social/PostTrustStrip";
import { RescueJourneyRibbon } from "./rescue/RescueJourneyRibbon";
import { SkillSpotlightRibbon } from "./skills/SkillSpotlightRibbon";
import { RescueJourneyCarousel } from "./rescue/RescueJourneyCarousel";
import { useBlockedIds } from "@/hooks/useBlockedIds";
import { usePawBurst } from "./social/PawBurst";
import { addReaction } from "@/lib/reactions";
import { haptic } from "@/lib/haptics";
import { usePublicProfiles } from "@/hooks/usePublicProfiles";
import { toast } from "sonner";
import { SmartImage } from "./SmartImage";
import { FeedSkeleton } from "./skeletons/FeedSkeleton";
import { Sparkles } from "lucide-react";

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
  rescue_journey_id?: string | null;
  skill_spotlight_id?: string | null;
  kind?: "moment" | "milestone" | "memorial" | "tribe_post" | null;
  pet_snapshot?: {
    name?: string | null;
    breed?: string | null;
    age_months?: number | null;
    avatar_url?: string | null;
    vaccines_ok?: boolean | null;
    city?: string | null;
  } | null;
  author?: { full_name: string | null; avatar_url: string | null; account_type?: string | null } | null;
  pet?: { name: string; avatar_url: string | null } | null;
};

export const PostFeed = ({ scope = "all", emptyState }: { scope?: "all" | "trending" | "following"; emptyState?: ReactNode }) => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [commentsFor, setCommentsFor] = useState<string | null>(null);
  const { data: blocked } = useBlockedIds();
  const { data: publicProfiles } = usePublicProfiles();
  const [searchParams] = useSearchParams();
  const focusId = searchParams.get("focus");

  const PAGE_SIZE = 12;
  const {
    data: pages,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["feed", scope, user?.id ?? null, blocked?.size ?? 0],
    enabled: publicProfiles !== undefined,
    initialPageParam: 0 as number,
    getNextPageParam: (lastPage: FeedPost[], all) =>
      lastPage.length < PAGE_SIZE ? undefined : all.length * PAGE_SIZE,
    queryFn: async ({ pageParam }): Promise<FeedPost[]> => {
      const offset = pageParam as number;
      let followingIds: string[] | null = null;
      if (scope === "following") {
        if (!user) return [];
        const { data: f } = await supabase
          .from("follows")
          .select("following_id")
          .eq("follower_id", user.id);
        followingIds = (f ?? []).map((r: any) => r.following_id);
        if (!followingIds.length) return [];
      }
      let q = supabase
        .from("posts")
        .select(
          "id, author_id, pet_id, caption, image_url, image_url_thumb, image_url_feed, image_url_full, like_count, comment_count, created_at, reaction_counts, rescue_journey_id, skill_spotlight_id, kind, pet_snapshot",
        );
      if (followingIds) q = q.in("author_id", followingIds);
      q =
        scope === "trending"
          ? q.order("like_count", { ascending: false }).order("created_at", { ascending: false })
          : q.order("created_at", { ascending: false });
      q = q.range(offset, offset + PAGE_SIZE - 1);
      const { data: postsRaw, error } = await q;
      if (error) throw error;
      const posts = (postsRaw ?? []).filter((p) => !blocked || !blocked.has(p.author_id));
      if (!posts?.length) return [];

      const petIds = [...new Set(posts.map((p) => p.pet_id).filter(Boolean) as string[])];
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

  const data = useMemo<FeedPost[]>(
    () => (pages?.pages ?? []).flat(),
    [pages],
  );

  // Infinite-scroll sentinel
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasNextPage) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { rootMargin: "600px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

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
            highlight={focusId === post.id}
          />
        ))}
        {hasNextPage && (
          <div ref={sentinelRef} className="py-6 text-center text-xs text-muted-foreground">
            {isFetchingNextPage ? "Loading more…" : ""}
          </div>
        )}
      </div>
      <CommentSheet postId={commentsFor} onOpenChange={(open) => !open && setCommentsFor(null)} />
    </>
  );
};

const PostCard = ({ post, onComment, highlight }: {
  post: FeedPost; onComment: () => void; highlight?: boolean;
}) => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: verifiedOrgs } = useVerifiedOrgs();
  const { data: pendingOrgs } = usePendingOrgs();
  const isOwner = !!user && user.id === post.author_id;
  const [editOpen, setEditOpen] = useState(false);
  const [editCaption, setEditCaption] = useState(post.caption ?? "");
  const [savingEdit, setSavingEdit] = useState(false);
  const cardRef = useRef<HTMLDivElement | null>(null);

  // Deep-link highlight pulse.
  useEffect(() => {
    if (!highlight) return;
    cardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [highlight]);

  const handleShare = async () => {
    haptic(8);
    const url = `${window.location.origin}/?focus=${post.id}`;
    const shareData = {
      title: post.author?.full_name ? `${post.author.full_name} on Petos` : "A post on Petos",
      text: post.caption ?? "Check out this Petos post",
      url,
    };
    try {
      if (navigator.share && navigator.canShare?.(shareData)) {
        await navigator.share(shareData);
        return;
      }
    } catch { /* user cancelled or failed — fall through */ }
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied");
    } catch {
      toast.error("Couldn't copy link");
    }
  };

  const handleDelete = async () => {
    if (!confirm("Delete this post? This can't be undone.")) return;
    const { error } = await supabase.from("posts").delete().eq("id", post.id);
    if (error) return toast.error(error.message);
    toast.success("Post deleted");
    qc.invalidateQueries({ queryKey: ["feed"] });
  };

  const handlePin = async () => {
    // Pin = bump updated_at so it sorts to top of profile grid.
    const { error } = await supabase
      .from("posts")
      .update({ updated_at: new Date().toISOString() } as any)
      .eq("id", post.id);
    if (error) return toast.error(error.message);
    toast.success("Pinned to your profile");
    qc.invalidateQueries({ queryKey: ["feed"] });
  };

  const saveEdit = async () => {
    setSavingEdit(true);
    const { error } = await supabase
      .from("posts")
      .update({ caption: editCaption.trim() || null } as any)
      .eq("id", post.id);
    setSavingEdit(false);
    if (error) return toast.error(error.message);
    toast.success("Caption updated");
    setEditOpen(false);
    qc.invalidateQueries({ queryKey: ["feed"] });
  };

  const authorVerified = !!(post.author_id && verifiedOrgs instanceof Set && verifiedOrgs.has(post.author_id));
  const authorPending = !!(post.author_id && pendingOrgs?.has(post.author_id));
  const accountType = post.author?.account_type ?? "pet_parent";
  const orgPost = isOrgRole(accountType) && !post.pet_id;
  // Bred-on-PetOS ribbon: breeder-authored post tied to a pet that has a litter_id
  const { data: postLitter } = useQuery({
    queryKey: ["post-pet-litter", post.pet_id],
    enabled: !!post.pet_id && accountType === "breeder",
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const { data } = await supabase.from("pets").select("litter_id").eq("id", post.pet_id!).maybeSingle();
      return (data?.litter_id as string | null) ?? null;
    },
  });
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
    <Card
      ref={cardRef}
      className={`rounded-2xl border-hairline bg-card shadow-none overflow-hidden transition-shadow ${
        highlight ? "ring-2 ring-primary ring-offset-2 ring-offset-background animate-pulse" : ""
      }`}
    >
      <div className="flex items-start gap-2">
        {orgPost ? (
          <div className="flex-1 min-w-0 p-4">
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
          <div className="flex-1 min-w-0">
            <PetPostHeader
              authorId={post.author_id}
              authorName={post.author?.full_name}
              authorAvatar={post.author?.avatar_url}
              accountType={accountType}
              petId={post.pet_id}
              pet={post.pet}
              petSnapshot={post.pet_snapshot}
              createdAt={post.created_at}
              authorVerified={authorVerified}
              authorPending={authorPending}
            />
            <div className="px-4 -mt-1 pb-1"><CollabBadge postId={post.id} /></div>
          </div>
        )}
        <div className="pr-3 pt-4">
          <FollowButton targetId={post.author_id} />
        </div>
      </div>

      {(post.image_url_feed || post.image_url) && (
        <div
          className="relative select-none"
          onClick={handleImageTap}
          onDoubleClick={(e) => e.preventDefault()}
        >
          <RescueJourneyRibbon journeyId={post.rescue_journey_id} />
          <SkillSpotlightRibbon spotlightId={post.skill_spotlight_id} />
          {postLitter && (
            <div className="absolute top-2 left-2 z-10 inline-flex items-center gap-1 rounded-full bg-card/95 backdrop-blur border border-coral/30 px-2 py-0.5 text-[10px] font-semibold text-coral shadow-sm">
              <Sparkles className="h-3 w-3" /> Bred on PetOS
            </div>
          )}
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

      <RescueJourneyCarousel journeyId={post.rescue_journey_id} />

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
        <button
          onClick={handleShare}
          className="flex items-center gap-1.5 px-3 py-2 rounded-full hover:bg-muted/60 transition-colors active:scale-110"
          aria-label="Share"
        >
          <Share2 className="h-5 w-5" strokeWidth={1.6} />
        </button>
        <div className="ml-auto pr-1">
          {isOwner ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full" aria-label="More">
                  <MoreHorizontal className="h-5 w-5" strokeWidth={1.6} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="rounded-xl">
                <DropdownMenuItem onClick={() => { setEditCaption(post.caption ?? ""); setEditOpen(true); }}>
                  <Pencil className="h-4 w-4 mr-2" /> Edit caption
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handlePin}>
                  <Pin className="h-4 w-4 mr-2" /> Pin to profile
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleDelete} className="text-destructive focus:text-destructive">
                  <Trash2 className="h-4 w-4 mr-2" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <ReportButton subjectType="post" subjectId={post.id} size="icon" />
          )}
        </div>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-display">Edit caption</DialogTitle>
          </DialogHeader>
          <Textarea
            value={editCaption}
            onChange={(e) => setEditCaption(e.target.value)}
            className="rounded-xl border-hairline min-h-[120px] resize-none"
            maxLength={500}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} className="rounded-xl">
              Cancel
            </Button>
            <Button onClick={saveEdit} disabled={savingEdit} className="rounded-xl">
              {savingEdit ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Check className="h-4 w-4 mr-1" /> Save</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

