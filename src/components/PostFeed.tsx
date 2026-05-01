import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
// avatars are rendered inside PetPostHeader / AuthorIdentity now
import { MoreHorizontal, Pencil, Trash2, Pin, Loader2, Check, Bookmark } from "lucide-react";
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
// SellerBadge is rendered by AuthorIdentity / PetPostHeader
import { useVerifiedOrgs, usePendingOrgs } from "@/hooks/useVerifiedOrgs";
import { isOrgRole } from "@/lib/roleTheme";
import { AuthorIdentity } from "./AuthorIdentity";
// ReactionBar / SaveButton are now rendered inside PostActionBar
import { CaptionWithTags } from "./social/CaptionWithTags";
// streak chip moved into PetPostHeader
import { PetPostHeader } from "./social/PetPostHeader";
// PostTrustStrip merged into PetPostHeader for pet cards; org posts use AuthorIdentity
import { PostActionBar } from "./social/PostActionBar";
import { PostKindBadge } from "./social/PostKindBadge";
import { PetIdentityPlate } from "./social/PetIdentityPlate";
import { PetCardActionBar } from "./social/PetCardActionBar";
import { useSwipe } from "@/lib/useSwipe";
import { useIsSaved, useToggleSave } from "@/hooks/usePostSave";
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
    lifetime_walks_km?: number | null;
    streak_days?: number | null;
    lineage_verified?: boolean | null;
  } | null;
  author?: { full_name: string | null; avatar_url: string | null; account_type?: string | null } | null;
  pet?: { name: string; avatar_url: string | null } | null;
};

export const PostFeed = ({ scope = "all", emptyState }: { scope?: "all" | "trending" | "following" | "tribe" | "nearby"; emptyState?: ReactNode }) => {
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
  // (display name/avatar/initial are computed inside PetPostHeader now)
  const { burst, node: pawLayer } = usePawBurst();
  const lastTapRef = useRef<{ t: number; x: number; y: number } | null>(null);
  const { data: isSaved } = useIsSaved(post.id);
  const toggleSave = useToggleSave();
  const [savedFlash, setSavedFlash] = useState(false);

  const handleSwipeRightSave = () => {
    if (!user) {
      toast.message("Sign in to save");
      return;
    }
    if (isSaved) {
      toast("Already saved", { icon: "🔖" });
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 700);
      return;
    }
    haptic(12);
    toggleSave.mutate({ postId: post.id, saved: false });
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 700);
    toast.success("Saved");
  };

  // Swipe-up on the card body opens the comment sheet (mobile-first interaction).
  // Swipe-right anywhere on the image saves the post with a confetti-style flash.
  const cardSwipe = useSwipe({ onSwipeUp: onComment });
  const imageSwipe = useSwipe({ onSwipeRight: handleSwipeRightSave });

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
        const inserted = await addReaction(post.id, user.id, "boop");
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

  // Per-kind premium variants — top stroke, ring tint, image overlay
  const kind = post.kind ?? "moment";
  const variantWrap =
    kind === "milestone"
      ? "ring-1 ring-amber-300/50 shadow-[0_1px_0_rgba(0,0,0,0.04),0_12px_32px_-16px_rgba(245,158,11,0.35)]"
      : kind === "memorial"
      ? "ring-1 ring-amber-700/30 shadow-[0_1px_0_rgba(0,0,0,0.04),0_12px_32px_-16px_rgba(120,53,15,0.35)] bg-gradient-to-b from-amber-50/40 to-card dark:from-amber-950/20"
      : kind === "tribe_post"
      ? "ring-1 ring-leaf/30 shadow-[0_1px_0_rgba(0,0,0,0.04),0_12px_32px_-16px_rgba(34,197,94,0.3)]"
      : "shadow-[0_1px_0_rgba(0,0,0,0.04),0_8px_24px_-12px_rgba(0,0,0,0.10)]";
  const variantTopStroke =
    kind === "milestone"
      ? "before:content-[''] before:absolute before:inset-x-0 before:top-0 before:h-[3px] before:bg-gradient-to-r before:from-amber-300 before:via-coral before:to-amber-300"
      : kind === "memorial"
      ? "before:content-[''] before:absolute before:inset-x-0 before:top-0 before:h-[3px] before:bg-gradient-to-r before:from-amber-700/0 before:via-amber-700 before:to-amber-700/0"
      : kind === "tribe_post"
      ? "before:content-[''] before:absolute before:inset-x-0 before:top-0 before:h-[3px] before:bg-gradient-to-r before:from-leaf/0 before:via-leaf before:to-leaf/0"
      : "";
  const imageTint =
    kind === "memorial"
      ? "after:content-[''] after:absolute after:inset-0 after:bg-gradient-to-b after:from-amber-900/10 after:via-transparent after:to-amber-900/15 after:pointer-events-none"
      : "";
  const captionShort = (post.caption?.length ?? 0) <= 80 && (post.image_url_feed || post.image_url);

  const hasImage = !!(post.image_url_feed || post.image_url);
  const hasPet = !!(post.pet || post.pet_snapshot?.name);
  const usePetCardLayout = !orgPost && hasPet && hasImage;

  // Footer meta for pet card layout — owner + follow live BELOW the actions, not at the top
  const petFooterByLine = (
    <span className="inline-flex items-center gap-1.5">
      <span>by</span>
      <Link to={`/u/${post.author_id}`} className="hover:underline font-medium text-foreground/70 truncate max-w-[140px]">
        {post.author?.full_name ?? "owner"}
      </Link>
      <span>·</span>
      <span>{formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}</span>
    </span>
  );

  const ownerMenu = isOwner ? (
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
  );

  return (
    <Card
      ref={cardRef}
      {...cardSwipe}
      className={`relative rounded-3xl border-hairline bg-card overflow-hidden transition-all duration-200 ${variantWrap} ${variantTopStroke} ${
        highlight ? "ring-2 ring-primary ring-offset-2 ring-offset-background animate-pulse" : ""
      }`}
    >
      {/* ============ Pet card layout (full-bleed photo with floating identity plate) ============ */}
      {usePetCardLayout ? (
        <>
          <div
            className={`relative select-none ${imageTint}`}
            onClick={handleImageTap}
            onDoubleClick={(e) => e.preventDefault()}
            {...imageSwipe}
          >
            <RescueJourneyRibbon journeyId={post.rescue_journey_id} />
            <SkillSpotlightRibbon spotlightId={post.skill_spotlight_id} />
            <PostKindBadge kind={post.kind} />
            {postLitter && (
              <div className="absolute top-3 left-3 z-10 inline-flex items-center gap-1 rounded-full bg-card/95 backdrop-blur border border-coral/30 px-2 py-0.5 text-[10px] font-semibold text-coral shadow-sm">
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
              aspect="4/5"
              alt=""
            />
            {/* Soft bottom gradient so the floating plate is always legible on busy photos */}
            <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/35 via-black/10 to-transparent pointer-events-none" />

            <PetIdentityPlate
              petId={post.pet_id}
              authorId={post.author_id}
              pet={post.pet}
              petSnapshot={post.pet_snapshot}
              accountType={accountType}
            />
            {pawLayer}
            {savedFlash && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none animate-fade-in z-20">
                <div className="bg-foreground/85 text-background rounded-full px-4 py-2 flex items-center gap-2 shadow-lg animate-scale-in">
                  <Bookmark className="h-4 w-4 fill-current" />
                  <span className="text-sm font-semibold">Saved</span>
                </div>
              </div>
            )}
          </div>

          {post.caption && (
            <CaptionWithTags
              text={post.caption}
              className="px-4 pt-3 text-[15px] leading-relaxed text-foreground whitespace-pre-wrap font-display"
            />
          )}

          <div className="px-4 pt-1"><CollabBadge postId={post.id} /></div>
          <RescueJourneyCarousel journeyId={post.rescue_journey_id} />

          <PetCardActionBar
            postId={post.id}
            reactionCounts={post.reaction_counts as any}
            commentCount={post.comment_count}
            authorByLine={petFooterByLine}
            followSlot={<FollowButton targetId={post.author_id} />}
            trailing={ownerMenu}
            onComment={onComment}
            onShare={handleShare}
          />
        </>
      ) : (
        /* ============ Legacy layout for org posts / posts without an image ============ */
        <>
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

          {hasImage && (
            <div
              className={`relative select-none ${imageTint}`}
              onClick={handleImageTap}
              onDoubleClick={(e) => e.preventDefault()}
              {...imageSwipe}
            >
              <RescueJourneyRibbon journeyId={post.rescue_journey_id} />
              <SkillSpotlightRibbon spotlightId={post.skill_spotlight_id} />
              <PostKindBadge kind={post.kind} />
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

          <PostActionBar
            postId={post.id}
            reactionCounts={post.reaction_counts as any}
            commentCount={post.comment_count}
            onComment={onComment}
            onShare={handleShare}
            trailing={ownerMenu}
          />
        </>
      )}

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

