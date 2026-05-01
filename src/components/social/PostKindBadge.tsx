import { Cake, Users, HeartHandshake, Sparkles } from "lucide-react";

type Kind = "moment" | "milestone" | "memorial" | "tribe_post" | null | undefined;

const MAP: Record<string, { label: string; Icon: any; cls: string }> = {
  milestone: {
    label: "Milestone",
    Icon: Cake,
    cls: "bg-gradient-to-r from-amber-400 to-coral text-white border-white/30",
  },
  memorial: {
    label: "In memory",
    Icon: HeartHandshake,
    cls: "bg-gradient-to-r from-amber-700/90 to-amber-900/90 text-white border-amber-200/40",
  },
  tribe_post: {
    label: "Tribe",
    Icon: Users,
    cls: "bg-gradient-to-r from-leaf to-emerald-600 text-white border-white/30",
  },
};

/**
 * Floating ribbon on the top-right of the image. Premium gradient pills,
 * higher than the rest of the chrome so it reads as the post's "stamp".
 */
export const PostKindBadge = ({ kind }: { kind: Kind }) => {
  if (!kind || kind === "moment") return null;
  const cfg = MAP[kind];
  if (!cfg) return null;
  const { Icon, label, cls } = cfg;
  return (
    <div
      className={`absolute top-3 right-3 z-20 inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10.5px] font-semibold shadow-md backdrop-blur-md ${cls}`}
    >
      <Icon className="h-3 w-3" />
      <span>{label}</span>
      <Sparkles className="h-2.5 w-2.5 opacity-80" />
    </div>
  );
};

export default PostKindBadge;
