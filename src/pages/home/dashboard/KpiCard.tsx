import { Card } from "@/components/ui/card";
import { Loader2, type LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

export const KpiCard = ({
  label,
  value,
  sub,
  icon: Icon,
  to,
  loading,
  tint = "bg-primary/5",
}: {
  label: string;
  value: number | string | null | undefined;
  sub?: string;
  icon: LucideIcon;
  to?: string;
  loading?: boolean;
  tint?: string;
}) => {
  const inner = (
    <Card
      className={cn(
        "rounded-2xl border-hairline shadow-none p-4 flex items-start gap-3 active:scale-[0.99] transition-transform",
        tint,
      )}
    >
      <div className="h-10 w-10 rounded-xl bg-background grid place-items-center shrink-0">
        <Icon className="h-5 w-5 text-foreground/70" strokeWidth={1.6} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground font-semibold truncate">
          {label}
        </div>
        <div className="font-display text-2xl mt-0.5 leading-none">
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : (
            (value ?? 0)
          )}
        </div>
        {sub ? <div className="text-xs text-muted-foreground mt-1 truncate">{sub}</div> : null}
      </div>
    </Card>
  );
  return to ? <Link to={to}>{inner}</Link> : inner;
};

export default KpiCard;
