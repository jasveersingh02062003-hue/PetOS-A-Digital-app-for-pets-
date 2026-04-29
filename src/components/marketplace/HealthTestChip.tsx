import { ShieldCheck, BadgeCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { resultTone, type HealthTestEntry } from "@/lib/healthTests";

/**
 * Compact chip for one screening result. Shows a tiny green tick when a
 * verified vet has attested it (`verified_by` set).
 */
export const HealthTestChip = ({
  entry,
  className,
}: {
  entry: HealthTestEntry;
  className?: string;
}) => {
  const tone = resultTone(entry.result);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 h-5 text-[10px] font-medium border",
        tone === "good" && "bg-leaf/10 text-leaf border-leaf/30",
        tone === "warn" && "bg-amber-500/10 text-amber-700 border-amber-500/30 dark:text-amber-400",
        tone === "neutral" && "bg-muted text-foreground border-hairline",
        className,
      )}
      title={`${entry.label}: ${entry.result}${entry.verified_by ? " · vet-verified" : ""}`}
    >
      <ShieldCheck className="h-2.5 w-2.5" />
      <span className="truncate max-w-[140px]">
        {entry.label} {entry.result}
      </span>
      {entry.verified_by && <BadgeCheck className="h-2.5 w-2.5 text-leaf" />}
    </span>
  );
};

export const HealthTestRail = ({
  entries,
  max = 3,
  className,
}: {
  entries: HealthTestEntry[] | null | undefined;
  max?: number;
  className?: string;
}) => {
  if (!entries?.length) return null;
  const shown = entries.slice(0, max);
  const extra = entries.length - shown.length;
  return (
    <div className={cn("flex flex-wrap gap-1", className)}>
      {shown.map((e, i) => (
        <HealthTestChip key={`${e.code}-${i}`} entry={e} />
      ))}
      {extra > 0 && (
        <span className="inline-flex items-center rounded-full px-2 h-5 text-[10px] bg-muted text-muted-foreground border border-hairline">
          +{extra}
        </span>
      )}
    </div>
  );
};