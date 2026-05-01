import { Cake, Sparkles, Users, HeartHandshake } from "lucide-react";

type Kind = "moment" | "milestone" | "memorial" | "tribe_post" | null | undefined;

const MAP: Record<string, { label: string; Icon: any; cls: string }> = {
  milestone: {
    label: "Milestone",
    Icon: Cake,
    cls: "bg-coral/95 text-white border-coral",
  },
  memorial: {
    label: "Rainbow Bridge",
    Icon: HeartHandshake,
    cls: "bg-foreground/90 text-background border-foreground",
  },
  tribe_post: {
    label: "Tribe",
    Icon: Users,
    cls: "bg-leaf/95 text-white border-leaf",
  },
};

/**
 * Floating ribbon on the top-right of the image. Only renders when the post
 * has a special kind — never for plain "moment" posts.
 */
export const PostKindBadge = ({ kind }: { kind: Kind }) => {
  if (!kind || kind === "moment") return null;
  const cfg = MAP[kind];
  if (!cfg) return null;
  const { Icon, label, cls } = cfg;
  return (
    <div
      className={`absolute top-2 right-2 z-10 inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-semibold shadow-sm backdrop-blur ${cls}`}
    >
      <Icon className="h-3 w-3" /> {label}
    </div>
  );
};

export default PostKindBadge;
