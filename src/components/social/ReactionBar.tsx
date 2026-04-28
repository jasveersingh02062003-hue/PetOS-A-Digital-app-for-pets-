import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AnimatePresence, motion } from "framer-motion";
import { haptic } from "@/lib/haptics";

export type ReactionKind = "love" | "paw" | "laugh" | "wow" | "sad";

const REACTIONS: { kind: ReactionKind; emoji: string; label: string }[] = [
  { kind: "love", emoji: "❤️", label: "Love" },
  { kind: "paw", emoji: "🐾", label: "Paw" },
  { kind: "laugh", emoji: "😂", label: "Haha" },
  { kind: "wow", emoji: "😍", label: "Wow" },
  { kind: "sad", emoji: "😢", label: "Sad" },
];

type Counts = Partial<Record<ReactionKind, number>>;

export const ReactionBar = ({
  postId,
  initialCounts,
}: {
  postId: string;
  initialCounts?: Counts;
}) => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: mine } = useQuery({
    queryKey: ["post-reactions-mine", postId, user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("post_reactions")
        .select("kind")
        .eq("post_id", postId)
        .eq("user_id", user!.id);
      if (error) throw error;
      return new Set((data ?? []).map((r: any) => r.kind as ReactionKind));
    },
  });

  const { data: counts } = useQuery({
    queryKey: ["post-reactions-counts", postId],
    initialData: initialCounts ?? {},
    queryFn: async () => {
      const { data } = await supabase.from("posts").select("reaction_counts").eq("id", postId).maybeSingle();
      return ((data as any)?.reaction_counts ?? {}) as Counts;
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel(`pr-${postId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "post_reactions", filter: `post_id=eq.${postId}` }, () => {
        qc.invalidateQueries({ queryKey: ["post-reactions-counts", postId] });
        qc.invalidateQueries({ queryKey: ["post-reactions-mine", postId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [postId, qc]);

  const toggle = async (kind: ReactionKind) => {
    if (!user) return toast.error("Please sign in");
    setOpen(false);
    haptic(10);
    const has = mine?.has(kind);
    if (has) {
      await supabase.from("post_reactions").delete().eq("post_id", postId).eq("user_id", user.id).eq("kind", kind);
    } else {
      await supabase.from("post_reactions").insert({ post_id: postId, user_id: user.id, kind });
    }
  };

  const total = Object.values(counts ?? {}).reduce((s: number, n: any) => s + (Number(n) || 0), 0);
  const top = REACTIONS.filter((r) => (counts?.[r.kind] ?? 0) > 0).slice(0, 3);
  const myFirst = REACTIONS.find((r) => mine?.has(r.kind));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          onClick={() => myFirst ? toggle(myFirst.kind) : toggle("love")}
          onContextMenu={(e) => { e.preventDefault(); setOpen(true); }}
          onTouchStart={(e) => {
            const t = setTimeout(() => setOpen(true), 350);
            const cancel = () => clearTimeout(t);
            e.currentTarget.addEventListener("touchend", cancel, { once: true });
            e.currentTarget.addEventListener("touchmove", cancel, { once: true });
          }}
          className="flex items-center gap-1.5 px-3 py-2 rounded-full hover:bg-muted/60 transition-colors active:scale-95"
          aria-label="React"
        >
          {top.length > 0 ? (
            <span className="flex -space-x-1">
              {top.map((r) => (
                <motion.span
                  key={r.kind}
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 400, damping: 18 }}
                  className="text-base leading-none"
                >
                  {r.emoji}
                </motion.span>
              ))}
            </span>
          ) : (
            <span className={`text-base leading-none ${myFirst ? "" : "grayscale opacity-60"}`}>
              {myFirst?.emoji ?? "❤️"}
            </span>
          )}
          <span className="text-sm tabular-nums relative inline-block min-w-[1ch] text-center overflow-hidden h-[1.25em] leading-[1.25em]">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={total}
                initial={{ y: 8, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -8, opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="inline-block"
              >
                {total}
              </motion.span>
            </AnimatePresence>
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" align="start" className="p-1.5 rounded-full w-auto border-hairline">
        <div className="flex items-center gap-0.5">
          {REACTIONS.map((r) => {
            const active = mine?.has(r.kind);
            return (
              <button
                key={r.kind}
                onClick={() => toggle(r.kind)}
                title={r.label}
                className={`h-9 w-9 flex items-center justify-center rounded-full text-xl transition-transform hover:scale-125 active:scale-110 ${active ? "bg-primary-soft animate-pop" : ""}`}
              >
                {r.emoji}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
};

