import { Star } from "lucide-react";

type Props = {
  rating: number;
  size?: "sm" | "md" | "lg";
  count?: number | null;
  interactive?: boolean;
  onChange?: (n: number) => void;
};

const sizeMap = { sm: "h-3 w-3", md: "h-4 w-4", lg: "h-6 w-6" };

export const RatingStars = ({ rating, size = "sm", count, interactive, onChange }: Props) => {
  const cls = sizeMap[size];
  return (
    <div className="inline-flex items-center gap-1">
      <div className="inline-flex">
        {[1, 2, 3, 4, 5].map((n) => {
          const filled = n <= Math.round(rating);
          return interactive ? (
            <button
              key={n}
              type="button"
              onClick={() => onChange?.(n)}
              className="p-0.5 hover:scale-110 transition-transform"
            >
              <Star className={`${cls} ${filled ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`} />
            </button>
          ) : (
            <Star
              key={n}
              className={`${cls} ${filled ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40"}`}
            />
          );
        })}
      </div>
      {!interactive && rating > 0 && (
        <span className="text-xs text-muted-foreground tabular-nums">
          {rating.toFixed(1)}
          {count != null && ` (${count})`}
        </span>
      )}
    </div>
  );
};
