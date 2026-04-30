import { MapPin } from "lucide-react";

type Props = {
  count?: number | null;
  loading?: boolean;
  city?: string | null;
  /** Optional secondary line, e.g. "Delivers to 400001 · 2-4 days". */
  detail?: string;
  className?: string;
};

/** Amazon-style "324 results in Mumbai · 2-4 day delivery" line. */
export const ResultsHeader = ({ count, loading, city, detail, className = "" }: Props) => {
  if (loading) {
    return <div className={`h-4 w-40 bg-muted/60 rounded animate-pulse ${className}`} />;
  }
  return (
    <div className={`flex items-center justify-between gap-2 text-xs text-muted-foreground ${className}`}>
      <span className="font-medium">
        {count != null ? <span className="text-foreground">{count.toLocaleString("en-IN")}</span> : "—"}{" "}
        {count === 1 ? "result" : "results"}
        {city && (
          <>
            {" "}
            <span className="opacity-60">in</span>{" "}
            <span className="text-foreground inline-flex items-center gap-0.5">
              <MapPin className="h-3 w-3" /> {city}
            </span>
          </>
        )}
      </span>
      {detail && <span className="truncate">{detail}</span>}
    </div>
  );
};