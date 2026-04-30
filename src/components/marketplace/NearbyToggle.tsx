import { Navigation } from "lucide-react";

/**
 * Compact pill that toggles "nearest first" sorting on a list page.
 * Disabled (with tooltip) when the user has no usable location.
 */
export function NearbyToggle({
  active,
  onChange,
  hasLocation,
  className = "",
  label = "Nearest",
}: {
  active: boolean;
  onChange: (next: boolean) => void;
  hasLocation: boolean;
  className?: string;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => hasLocation && onChange(!active)}
      disabled={!hasLocation}
      aria-pressed={active}
      title={hasLocation ? "Sort nearest first" : "Enable location to sort nearest first"}
      className={`shrink-0 inline-flex items-center gap-1 h-8 px-3 rounded-full border text-xs font-medium transition disabled:opacity-50 disabled:cursor-not-allowed ${
        active && hasLocation
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-card border-hairline text-muted-foreground hover:text-foreground"
      } ${className}`}
    >
      <Navigation className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}