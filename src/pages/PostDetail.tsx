import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSeo } from "@/hooks/useSeo";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";
import { CommentSheet } from "@/components/CommentSheet";
import { SmartImage } from "@/components/SmartImage";
import { CaptionWithTags } from "@/components/social/CaptionWithTags";
import { PetIdentityPlate } from "@/components/social/PetIdentityPlate";
import { PetCardActionBar } from "@/components/social/PetCardActionBar";
import { PostKindBadge } from "@/components/social/PostKindBadge";
import { FollowButton } from "@/components/social/FollowButton";
import { formatDistanceToNow } from "date-fns";

/**
 * Single-post page at `/post/:id`.
 *
 * Two reasons this exists:
 *
 * 1. Real share-link previews. We inject `og:image` pointing at the
 *    `og-post` edge function so WhatsApp / Twitter / Telegram render a
 *    branded preview card with the pet identity baked in (instead of the
 *    generic favicon you get from `/?focus=`).
 *
 * 2. Deep links from notifications. "X 🐾 your post" notifications now link
 *    to a focused page, not the feed scrolled to a card — clearer mental
 *    model on mobile.
 *
 * The in-app share button (`PostFeed.handleShare`) now points here too.
 */
const PostDetail = () => {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const [commentsOpen, setCommentsOpen] = useState(false);

  const { data: post, isLoading } = useQuery({
    queryKey: ["post-detail", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("posts")
        .select(
          "id, author_id, pet_id, caption, image_url, image_url_thumb, image_url_feed, image_url_full, like_count, comment_count, created_at, reaction_counts, kind, pet_snapshot, visibility",
        )
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: pet } = useQuery({
    queryKey: ["post-detail-pet", post?.pet_id],
    enabled: !!post?.pet_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("pets")
        .select("id, name, avatar_url")
        .eq("id", post!.pet_id!)
        .maybeSingle();
      return data;
    },
  });

  const { data: author } = useQuery({
    queryKey: ["post-detail-author", post?.author_id],
    enabled: !!post?.author_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url, account_type")
        .eq("id", post!.author_id!)
        .maybeSingle();
      return data;
    },
  });

  const snap = (post?.pet_snapshot ?? {}) as Record<string, any>;
  const petName = snap.name ?? pet?.name ?? "A pet";
  const seoTitle = post
    ? `${petName} on Petos${post.caption ? ` — ${post.caption.slice(0, 60)}` : ""}`
    : "Petos";
  const seoDesc = post?.caption?.slice(0, 155) ?? `See ${petName}'s moments on Petos.`;
  const ogImage = id
    ? `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/og-post?id=${id}`
    : undefined;

  useSeo({
    title: seoTitle,
    description: seoDesc,
    image: ogImage,
    type: "article",
  });

  // If post is private/missing, send the user back home.
  useEffect(() => {
    if (!isLoading && (!post || post.visibility !== "public")) {
      // Don't redirect immediately — show a "not found" panel so deep links
      // from old shares don't kick people out unexpectedly.
    }
  }, [isLoading, post]);

  if (isLoading) {
    return (
      <div className="container-app pad-top-safe py-8 flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!post) {
    return (
      <div className="container-app pad-top-safe py-10">
        <Card className="rounded-2xl p-8 text-center">
          <div className="font-display text-xl">Post not found</div>
          <p className="text-sm text-muted-foreground mt-2">It may have been deleted or set to private.</p>
          <Button onClick={() => nav("/")} className="mt-4 rounded-xl">Back to feed</Button>
        </Card>
      </div>
    );
  }

  const accountType = author?.account_type ?? "pet_parent";
  const hasImage = !!(post.image_url_feed || post.image_url);
  const hasPet = !!(pet || snap.name);
  const usePetCardLayout = hasPet && hasImage;

  const handleShare = async () => {
    const url = window.location.href;
    const shareData = {
      title: `${petName} on Petos`,
      text: post.caption ?? `Check out ${petName} on Petos`,
      url,
    };
    try {
      if (navigator.share && navigator.canShare?.(shareData)) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(url);
      }
    } catch { /* user cancelled */ }
  };

  return (
    <div className="container-app pad-top-safe py-4 max-w-xl">
      <button
        onClick={() => nav(-1)}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-3"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <Card className="relative rounded-3xl border-hairline bg-card overflow-hidden shadow-[0_1px_0_rgba(0,0,0,0.04),0_8px_24px_-12px_rgba(0,0,0,0.10)]">
        {usePetCardLayout ? (
          <>
            <div className="relative">
              <PostKindBadge kind={post.kind as any} />
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
              <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/35 via-black/10 to-transparent pointer-events-none" />
              <PetIdentityPlate
                petId={post.pet_id}
                authorId={post.author_id}
                pet={pet ?? null}
                petSnapshot={snap as any}
                accountType={accountType}
              />
            </div>

            {post.caption && (
              <CaptionWithTags
                text={post.caption}
                className="px-4 pt-3 text-[15px] leading-relaxed text-foreground whitespace-pre-wrap font-display"
              />
            )}

            <PetCardActionBar
              postId={post.id}
              reactionCounts={post.reaction_counts as any}
              commentCount={post.comment_count}
              authorByLine={
                <span className="inline-flex items-center gap-1.5">
                  <span>by</span>
                  <Link to={`/u/${post.author_id}`} className="hover:underline font-medium text-foreground/70 truncate max-w-[140px]">
                    {author?.full_name ?? "owner"}
                  </Link>
                  <span>·</span>
                  <span>{formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}</span>
                </span>
              }
              followSlot={<FollowButton targetId={post.author_id} />}
              onComment={() => setCommentsOpen(true)}
              onShare={handleShare}
            />
          </>
        ) : (
          <div className="p-4">
            <div className="text-sm text-muted-foreground mb-2">
              by{" "}
              <Link to={`/u/${post.author_id}`} className="font-medium text-foreground hover:underline">
                {author?.full_name ?? "someone"}
              </Link>{" "}
              · {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
            </div>
            {post.caption && (
              <CaptionWithTags
                text={post.caption}
                className="text-[15px] leading-relaxed whitespace-pre-wrap"
              />
            )}
            {hasImage && (
              <div className="mt-3 -mx-4">
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
              </div>
            )}
            <div className="pt-3">
              <PetCardActionBar
                postId={post.id}
                reactionCounts={post.reaction_counts as any}
                commentCount={post.comment_count}
                authorByLine={null}
                followSlot={<FollowButton targetId={post.author_id} />}
                onComment={() => setCommentsOpen(true)}
                onShare={handleShare}
              />
            </div>
          </div>
        )}
      </Card>

      <CommentSheet postId={commentsOpen ? post.id : null} onOpenChange={(o) => !o && setCommentsOpen(false)} />
    </div>
  );
};

export default PostDetail;
