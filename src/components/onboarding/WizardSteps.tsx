import { Check } from "lucide-react";

/**
 * Reusable progress header. Supports any number of steps.
 * Pass `current` (1-indexed) and an array of labels.
 */
export function WizardSteps({
  current,
  labels = ["Account type", "Details", "All set"],
}: {
  current: number;
  labels?: string[];
}) {
  return (
    <div className="flex items-center gap-2 mb-6 overflow-x-auto">
      {labels.map((label, i) => {
        const step = i + 1;
        const done = step < current;
        const active = step === current;
        return (
          <div key={label} className="flex items-center gap-2 flex-1 min-w-0">
            <div
              className={`h-7 w-7 shrink-0 rounded-full grid place-items-center text-xs font-medium ${
                done
                  ? "bg-primary text-primary-foreground"
                  : active
                  ? "bg-primary/15 text-primary border border-primary"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {done ? <Check className="h-3.5 w-3.5" /> : step}
            </div>
            <span
              className={`text-xs truncate ${
                active ? "text-foreground font-medium" : "text-muted-foreground"
              }`}
            >
              {label}
            </span>
            {i < labels.length - 1 && <div className="flex-1 h-px bg-border" />}
          </div>
        );
      })}
    </div>
  );
}
