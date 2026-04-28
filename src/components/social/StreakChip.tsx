import { Flame } from "lucide-react";
import { cn } from "@/lib/utils";

export const StreakChip = ({ streak, className }: { streak: number; className?: string }) => {
  if (!streak) return null;
  const hot = streak >= 7;
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold",
        hot ? "bg-orange-500/15 text-orange-600 dark:text-orange-400" : "bg-muted text-foreground",
        className,
      )}
    >
      <Flame className={cn("h-3.5 w-3.5", hot && "fill-current")} />
      {streak}-day streak
    </div>
  );
};
