import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

/** Subtle premium badge for users on Petos Plus. Calm, never loud. */
export const PlusBadge = ({ className, size = "sm" }: { className?: string; size?: "sm" | "xs" }) => (
  <span
    className={cn(
      "inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary font-medium",
      size === "xs" ? "text-[10px] px-1.5 py-0.5" : "text-[11px] px-2 py-0.5",
      className,
    )}
    title="Petos Plus member"
  >
    <Sparkles className={size === "xs" ? "h-2.5 w-2.5" : "h-3 w-3"} strokeWidth={2} />
    Plus
  </span>
);
