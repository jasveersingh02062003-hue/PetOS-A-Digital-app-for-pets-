import { Check } from "lucide-react";

/**
 * Reusable progress header for the 3-step onboarding wizard.
 * Step 1: Pick role  ·  Step 2: Add pet OR fill org  ·  Step 3: Done
 */
export function WizardSteps({
  current,
  labels = ["Account type", "Details", "All set"],
}: {
  current: 1 | 2 | 3;
  labels?: [string, string, string];
}) {
  return (
    <div className="flex items-center gap-2 mb-6">
      {labels.map((label, i) => {
        const step = (i + 1) as 1 | 2 | 3;
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
            {i < 2 && <div className="flex-1 h-px bg-border" />}
          </div>
        );
      })}
    </div>
  );
}