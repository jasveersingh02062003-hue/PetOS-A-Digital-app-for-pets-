import { MapPin } from "lucide-react";

export function DistanceChip({ distanceKm, className = "" }: { distanceKm?: number | null; className?: string }) {
  if (distanceKm == null || !isFinite(distanceKm)) return null;
  const label = distanceKm < 1
    ? `${Math.round(distanceKm * 1000)} m`
    : distanceKm < 10
      ? `${distanceKm.toFixed(1)} km`
      : `${Math.round(distanceKm)} km`;
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] text-muted-foreground ${className}`}>
      <MapPin className="h-3 w-3" /> {label}
    </span>
  );
}