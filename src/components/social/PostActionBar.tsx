import { MessageCircle, Share2 } from "lucide-react";
import { ReactionBar } from "./ReactionBar";
import { SaveButton } from "./SaveButton";
import { cn } from "@/lib/utils";

type Counts = Partial<Record<string, number>>;

const PET_REACTIONS: { kind: string; emoji: string }[] = [
  { kind: "boop", emoji: "🐾" },
  { kind: "treat", emoji: "🦴" },
  { kind: "yummy", emoji: "😋" },
  { kind: "love", emoji: "❤️" },
  { kind: "strong", emoji: "💪" },
  { kind: "cute", emoji: "🥰" },
];

/**
 * Premium post action bar.
 * - Single "headline" line above the actions: stacked top emojis + total "paws".
 *   Reads as one number, not a Top-3 leaderboard.
 * - Generous 44px+ tap targets, subtle hairline divider.
 * - Trailing slot (right-aligned) for owner menu / report.
 */
export const PostActionBar = ({
  postId,
  reactionCounts,
  commentCount,
  onComment,
  onShare,
  trailing,
}: {
  postId: string;
  reactionCounts?: Counts | null;
  commentCount: number;
  onComment: () => void;
  onShare: () => void;
  trailing?: React.ReactNode;
}) => {
  const counts = reactionCounts ?? {};
  const ranked = PET_REACTIONS
    .map((r) => ({ ...r, n: Number(counts[r.kind] ?? 0) }))
    .filter((r) => r.n > 0)
    .sort((a, b) => b.n - a.n);
  const top3 = ranked.slice(0, 3);
  const total = ranked.reduce((s, r) => s + r.n, 0);

  return (
    <div className="border-t border-hairline mt-1">
      {total > 0 && (
        <button
          onClick={onComment}
          className="w-full px-4 pt-2.5 pb-1 flex items-center justify-between text-[12px] text-muted-foreground hover:bg-muted/30 transition-colors"
          aria-label="See reactions"
        >
          <span className="flex items-center gap-1.5">
            <span className="flex -space-x-1.5">
              {top3.map((r) => (
                <span
                  key={r.kind}
                  className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-card ring-1 ring-hairline text-[12px] leading-none"
                >
                  {r.emoji}
                </span>
              ))}
            </span>
            <span className="font-semibold text-foreground/85 tabular-nums">{total}</span>
            <span>{total === 1 ? "paw" : "paws"}</span>
          </span>
          {commentCount > 0 && (
            <span className="tabular-nums">{commentCount} {commentCount === 1 ? "comment" : "comments"}</span>
          )}
        </button>
      )}
      <div className="flex items-center gap-1 px-2 py-1.5">
        <ReactionBar postId={postId} initialCounts={counts as any} />
        <button
          onClick={onComment}
          className={cn(
            "flex items-center gap-1.5 px-3 py-2 rounded-full",
            "hover:bg-muted/60 transition-colors active:scale-95",
          )}
          aria-label="Comment"
        >
          <MessageCircle className="h-5 w-5" strokeWidth={1.6} />
          <span className="text-sm tabular-nums">{commentCount}</span>
        </button>
        <SaveButton postId={postId} />
        <button
          onClick={onShare}
          className={cn(
            "flex items-center gap-1.5 px-3 py-2 rounded-full",
            "hover:bg-muted/60 transition-colors active:scale-95",
          )}
          aria-label="Share"
        >
          <Share2 className="h-5 w-5" strokeWidth={1.6} />
        </button>
        {trailing && <div className="ml-auto pr-1">{trailing}</div>}
      </div>
    </div>
  );
};

export default PostActionBar;
