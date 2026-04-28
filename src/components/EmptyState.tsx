import { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LucideIcon } from "lucide-react";

type Props = {
  icon: LucideIcon;
  title: string;
  description: string;
  ctaLabel?: string;
  onCta?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
  children?: ReactNode;
  tone?: "default" | "soft";
};

export const EmptyState = ({
  icon: Icon,
  title,
  description,
  ctaLabel,
  onCta,
  secondaryLabel,
  onSecondary,
  children,
  tone = "default",
}: Props) => {
  return (
    <Card
      className={`rounded-2xl border-hairline shadow-none p-7 text-center ${
        tone === "soft" ? "bg-primary/5 border-primary/20" : "bg-card"
      }`}
    >
      <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
        <Icon className="h-5 w-5 text-primary" strokeWidth={1.6} />
      </div>
      <div className="font-display text-lg leading-tight">{title}</div>
      <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed max-w-[280px] mx-auto">
        {description}
      </p>
      {(ctaLabel || secondaryLabel) && (
        <div className="mt-5 flex flex-col gap-2">
          {ctaLabel && onCta && (
            <Button onClick={onCta} className="rounded-xl h-11">
              {ctaLabel}
            </Button>
          )}
          {secondaryLabel && onSecondary && (
            <Button variant="ghost" onClick={onSecondary} className="rounded-xl h-10 text-sm">
              {secondaryLabel}
            </Button>
          )}
        </div>
      )}
      {children}
    </Card>
  );
};
