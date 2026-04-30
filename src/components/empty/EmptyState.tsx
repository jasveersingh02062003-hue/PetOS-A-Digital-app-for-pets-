import { Button } from "@/components/ui/button";
import { LucideIcon } from "lucide-react";
import { ReactNode } from "react";

type Props = {
  icon?: LucideIcon;
  title: string;
  description?: string;
  ctaLabel?: string;
  onCta?: () => void;
  children?: ReactNode;
  className?: string;
  /** Optional secondary action — typical use: "Expand radius" on geo-filtered lists */
  onExpandRadius?: () => void;
  expandRadiusLabel?: string;
};

export const EmptyState = ({
  icon: Icon,
  title,
  description,
  ctaLabel,
  onCta,
  children,
  className = "",
  onExpandRadius,
  expandRadiusLabel = "Expand radius",
}: Props) => {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center px-6 py-12 ${className}`}
    >
      {Icon && (
        <div className="mb-4 grid place-items-center w-16 h-16 rounded-full bg-muted">
          <Icon className="h-7 w-7 text-muted-foreground" />
        </div>
      )}
      <h3 className="font-display text-lg mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground max-w-xs mb-4">{description}</p>
      )}
      <div className="flex flex-wrap items-center justify-center gap-2">
        {ctaLabel && onCta && (
          <Button onClick={onCta} className="rounded-full">
            {ctaLabel}
          </Button>
        )}
        {onExpandRadius && (
          <Button onClick={onExpandRadius} variant="outline" className="rounded-full">
            {expandRadiusLabel}
          </Button>
        )}
      </div>
      {children}
    </div>
  );
};
