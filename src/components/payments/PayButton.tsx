import { Link } from "react-router-dom";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Kind = "transport" | "service" | "shop" | "mating" | "vet_consult";

interface Props {
  priceId: string;
  kind: Kind;
  refId: string;
  next?: string;
  label?: string;
  amountInr?: number;
  className?: string;
  variant?: "default" | "outline" | "secondary";
  size?: "default" | "sm" | "lg";
  disabled?: boolean;
}

export function PayButton({
  priceId, kind, refId, next, label, amountInr, className, variant = "default", size = "default", disabled,
}: Props) {
  const params = new URLSearchParams({ kind, ref: refId });
  if (next) params.set("next", next);
  const href = `/checkout/${priceId}?${params.toString()}`;
  const display =
    label ?? (amountInr != null ? `Pay ₹${amountInr.toLocaleString("en-IN")} & confirm` : "Pay & confirm");

  return (
    <Button asChild variant={variant} size={size} disabled={disabled} className={cn("gap-2", className)}>
      <Link to={href} aria-disabled={disabled}>
        <Lock className="h-4 w-4" />
        {display}
      </Link>
    </Button>
  );
}