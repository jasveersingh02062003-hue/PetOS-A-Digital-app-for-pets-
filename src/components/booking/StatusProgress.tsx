/**
 * Visualises a booking lifecycle as a row of dots with the active step pulsing.
 * Pure presentation — pass the canonical `flow` array and the current `status`.
 */
export function StatusProgress<T extends string>({
  flow,
  status,
  labels,
  className = "",
}: {
  flow: readonly T[];
  status: T;
  labels?: Partial<Record<T, string>>;
  className?: string;
}) {
  const idx = Math.max(0, flow.indexOf(status));
  return (
    <div className={`w-full ${className}`} aria-label={`Status: ${labels?.[status] ?? status}`}>
      <div className="flex items-center gap-1">
        {flow.map((step, i) => {
          const done = i < idx;
          const active = i === idx;
          return (
            <div key={step} className="flex-1 flex items-center gap-1 min-w-0">
              <div
                className={`h-2 w-2 rounded-full shrink-0 transition-all ${
                  done
                    ? "bg-primary"
                    : active
                      ? "bg-primary animate-pulse ring-2 ring-primary/30"
                      : "bg-muted"
                }`}
              />
              {i < flow.length - 1 && (
                <div
                  className={`h-[2px] flex-1 rounded-full transition-all ${
                    done ? "bg-primary" : "bg-muted"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-1.5 text-[11px] text-muted-foreground capitalize">
        {labels?.[status] ?? String(status).replace(/_/g, " ")}
      </div>
    </div>
  );
}