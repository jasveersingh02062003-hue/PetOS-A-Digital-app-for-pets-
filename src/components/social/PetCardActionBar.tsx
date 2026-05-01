import { MessageCircle, Share2, MoreHorizontal } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { haptic } from "@/lib/haptics";
import { toast } from "sonner";
import { SaveButton } from "./SaveButton";
import { cn } from "@/lib/utils";

type Counts = Partial<Record<string, number>>;

const REACTIONS: { kind: string; emoji: string; label: string }[] = [
  { kind: "boop", emoji: "🐾", label: "Boop" },
  { kind: "treat", emoji: "🦴", label: "Treat" },
  { kind: "love", emoji: "❤️", label: "Love" },
  { kind: "yummy", emoji: "😋", label: "Yummy" },
  { kind: "strong", emoji: "💪", label: "Strong" },
  { kind: "cute", emoji: "🥰", label: "Cute" },
];

/**
 * Tactile pet-card action bar.
 *
 * Structurally different from any IG/FB clone:
 * - LEFT: a single bold "boop pill" with stacked top-3 reaction emojis +
 *   total paw count. Long-press → reaction picker fan.
 * - CENTER: spacer / counts.
 * - RIGHT: comment, save, share — small ghost icons, no labels.
 * - FOOTER row beneath: tiny "by @owner · 22h" line with a slim Follow chip.
 *
 * No grey 5-icon row. The reaction is the hero action; everything else is
 * a quiet utility.
 */
export const PetCardActionBar = ({
  postId,
  reactionCounts,
  commentCount,
  authorByLine,
  followSlot,
  trailing,
  onComment,
  onShare,
}: {
  postId: string;
  reactionCounts?: Counts | null;
  commentCount: number;
  authorByLine?: React.ReactNode;
  followSlot?: React.ReactNode;
  trailing?: React.ReactNode;
  onComment: () => void;
  onShare: () => void;
}) => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [pickerOpen, setPickerOpen] = useState(false);

  const { data: mineRaw } = useQuery({
    queryKey: ["post-reactions-mine", postId, user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("post_reactions")
        .select("kind")
        .eq("post_id", postId)
        .eq("user_id", user!.id);
      return (data ?? []).map((r: any) => r.kind as string);
    },
  });
  const mine = useMemo<Set<string>>(
    () => (Array.isArray(mineRaw) ? new Set(mineRaw) : new Set()),
    [mineRaw],
  );

  const counts = reactionCounts ?? {};
  const ranked = REACTIONS
    .map((r) => ({ ...r, n: Number(counts[r.kind] ?? 0) }))
    .filter((r) => r.n > 0)
    .sort((a, b) => b.n - a.n);
  const top3 = ranked.slice(0, 3);
  const total = ranked.reduce((s, r) => s + r.n, 0);
  const myFirst = REACTIONS.find((r) => mine.has(r.kind));

  useEffect(() => {
    const ch = supabase
      .channel(`pcab-${postId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "post_reactions", filter: `post_id=eq.${postId}` },
        () => {
          qc.invalidateQueries({ queryKey: ["post-reactions-counts", postId] });
          qc.invalidateQueries({ queryKey: ["post-reactions-mine", postId] });
          qc.invalidateQueries({ queryKey: ["feed"] });
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [postId, qc]);

  const toggle = async (kind: string) => {
    if (!user) return toast.error("Please sign in");
    setPickerOpen(false);
    haptic(12);
    const has = mine.has(kind);
    if (has) {
      await supabase.from("post_reactions").delete().eq("post_id", postId).eq("user_id", user.id).eq("kind", kind);
    } else {
      await supabase.from("post_reactions").insert({ post_id: postId, user_id: user.id, kind });
    }
  };

  return (
    <div className="px-4 pt-3 pb-3">
      {/* Reaction headline + utility icons */}
      <div className="flex items-center gap-2">
        <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
          <PopoverTrigger asChild>
            <button
              onClick={() => toggle(myFirst?.kind ?? "boop")}
              onContextMenu={(e) => { e.preventDefault(); setPickerOpen(true); }}
              onTouchStart={(e) => {
                const t = setTimeout(() => setPickerOpen(true), 320);
                const cancel = () => clearTimeout(t);
                e.currentTarget.addEventListener("touchend", cancel, { once: true });
                e.currentTarget.addEventListener("touchmove", cancel, { once: true });
              }}
              aria-label="React"
              className={cn(
                "group inline-flex items-center gap-2 pl-1.5 pr-3 py-1.5 rounded-full",
                "bg-gradient-to-br from-primary/10 via-card to-primary-soft/40",
                "ring-1 ring-primary/20 hover:ring-primary/40",
                "active:scale-95 transition-all shadow-[0_2px_8px_-2px_rgba(0,0,0,0.08)]",
                myFirst && "ring-primary/50 from-primary/20",
              )}
            >
              {top3.length > 0 ? (
                <span className="flex -space-x-2">
                  {top3.map((r, i) => (
                    <motion.span
                      key={r.kind}
                      initial={{ scale: 0.4, opacity: 0, rotate: -20 }}
                      animate={{ scale: 1, opacity: 1, rotate: 0 }}
                      transition={{ delay: i * 0.04, type: "spring", stiffness: 400, damping: 18 }}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-card text-base ring-2 ring-card"
                    >
                      {r.emoji}
                    </motion.span>
                  ))}
                </span>
              ) : (
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-card text-base ring-2 ring-card">
                  🐾
                </span>
              )}
              <span className="font-display text-[15px] font-semibold leading-none tabular-nums min-w-[1ch]">
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.span
                    key={total}
                    initial={{ y: 6, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -6, opacity: 0 }}
                    transition={{ duration: 0.18 }}
                    className="inline-block"
                  >
                    {total}
                  </motion.span>
                </AnimatePresence>
              </span>
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                paws
              </span>
            </button>
          </PopoverTrigger>
          <PopoverContent
            side="top"
            align="start"
            sideOffset={10}
            className="p-2 rounded-full w-auto border-hairline bg-card/95 backdrop-blur-md shadow-[0_8px_32px_-8px_rgba(0,0,0,0.25)]"
          >
            <div className="flex items-center gap-1">
              {REACTIONS.map((r, i) => {
                const active = mine.has(r.kind);
                return (
                  <motion.button
                    key={r.kind}
                    initial={{ scale: 0, y: 14 }}
                    animate={{ scale: 1, y: 0 }}
                    transition={{ delay: i * 0.025, type: "spring", stiffness: 500, damping: 22 }}
                    onClick={() => toggle(r.kind)}
                    title={r.label}
                    aria-label={r.label}
                    className={cn(
                      "h-11 w-11 flex items-center justify-center rounded-full text-2xl transition-transform",
                      "hover:scale-[1.4] hover:-translate-y-1 active:scale-110",
                      active && "bg-primary-soft",
                    )}
                  >
                    {r.emoji}
                  </motion.button>
                );
              })}
            </div>
          </PopoverContent>
        </Popover>

        <div className="flex-1" />

        <button
          onClick={onComment}
          className="flex items-center gap-1 px-2.5 py-2 rounded-full text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors active:scale-95"
          aria-label="Comment"
        >
          <MessageCircle className="h-[20px] w-[20px]" strokeWidth={1.6} />
          {commentCount > 0 && <span className="text-[13px] tabular-nums">{commentCount}</span>}
        </button>
        <SaveButton postId={postId} />
        <button
          onClick={onShare}
          className="flex items-center px-2.5 py-2 rounded-full text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors active:scale-95"
          aria-label="Share"
        >
          <Share2 className="h-[20px] w-[20px]" strokeWidth={1.6} />
        </button>
        {trailing}
      </div>

      {/* Footer meta — owner moved here, intentionally quiet */}
      {(authorByLine || followSlot) && (
        <div className="flex items-center gap-2 mt-2.5 pt-2.5 border-t border-hairline/70">
          <div className="text-[11px] text-muted-foreground min-w-0 truncate flex-1">
            {authorByLine}
          </div>
          {followSlot}
        </div>
      )}
    </div>
  );
};

export default PetCardActionBar;
