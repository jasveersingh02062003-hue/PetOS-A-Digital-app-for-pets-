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
 * Single post action bar.
 *
 * Improvements over the old inline implementation:
 * - Adds a one-line "Top reactions" summary above the bar so the engagement
 *   is immediately legible (numbers next to emoji, not just a count badge).
 * - Restyled icon buttons with bigger touch targets and a faint divider above
 *   so the photo and the actions are visually separated.
 * - Layout is consistent across viewports.
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
  const top = PET_REACTIONS
    .map((r) => ({ ...r, n: Number(counts[r.kind] ?? 0) }))
    .filter((r) => r.n > 0)
    .sort((a, b) => b.n - a.n)
    .slice(0, 3);

  return (
    <div className="border-t border-hairline mt-2">
      {top.length > 0 && (
        <div className="px-4 pt-2 pb-1 flex items-center gap-3 text-[11px] text-muted-foreground">
          <span className="font-medium text-foreground/80">Top</span>
          {top.map((r) => (
            <span key={r.kind} className="inline-flex items-center gap-1">
              <span className="text-sm leading-none">{r.emoji}</span>
              <span className="tabular-nums">{r.n}</span>
            </span>
          ))}
        </div>
      )}
      <div className="flex items-center gap-1 px-2 py-1.5">
        <ReactionBar postId={postId} initialCounts={counts as any} />
        <button
          onClick={onComment}
          className={cn(
            "flex items-center gap-1.5 px-3 py-2 rounded-full",
            "hover:bg-muted/60 transition-colors active:scale-110",
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
            "hover:bg-muted/60 transition-colors active:scale-110",
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
