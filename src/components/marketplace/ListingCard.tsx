import { ReactNode, MouseEvent } from "react";
import { Link } from "react-router-dom";
import { Star } from "lucide-react";
import { LazyImage } from "@/components/LazyImage";
import { Button } from "@/components/ui/button";
import { WishlistButton } from "@/components/marketplace/WishlistButton";
import type { WishlistKind } from "@/hooks/useWishlist";
import { DistanceChip } from "@/components/marketplace/DistanceChip";
import { TrustChip, TrustChipKind } from "@/components/marketplace/TrustChip";
import { PriceTag } from "@/components/marketplace/PriceTag";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";

type Density = "comfortable" | "compact";

type Props = {
  /** Where the entire card links (detail page). */
  to: string;
  image?: string | null;
  imageAlt?: string;
  title: string;
  /** Optional small line above title (e.g. breed / category). */
  eyebrow?: string;
  /** Numeric price in INR; null = "Contact for price" (when contactWhenNull). */
  price?: number | null;
  priceSuffix?: string;
  /** Strikethrough MRP, optional. */
  mrp?: number | null;
  /** Use when no numeric price exists, e.g. "Free" or "From ₹500". */
  priceLabel?: string;
  city?: string | null;
  distanceKm?: number | null;
  rating?: { score: number; count: number } | null;
  /** Top-left ribbon (e.g. "Bred on PetOS"). */
  topLeftBadge?: ReactNode;
  /** Trust pills under the title (verified, KYC, etc.). */
  trustChips?: TrustChipKind[];
  /** Health/inventory chips (vaccinated, dewormed, In stock, etc.). */
  healthChips?: TrustChipKind[];
  /** Show wishlist heart top-right. Pass listing id to wire it up. */
  wishlistId?: string;
  /** Wishlist polymorphic kind. Defaults to 'pet' for back-compat. */
  wishlistKind?: WishlistKind;
  /** Primary CTA. */
  cta?: {
    label: string;
    onClick?: () => void;
    /** When true and user is logged out, swap label and route to /auth. */
    requiresAuth?: boolean;
    variant?: "default" | "outline" | "secondary";
  };
  density?: Density;
  /** Tag in the corner of the image (e.g. "Out of stock", "Live now"). */
  imageTag?: { label: string; tone?: "default" | "danger" | "success" };
  className?: string;
};

const TONE: Record<NonNullable<NonNullable<Props["imageTag"]>["tone"]>, string> = {
  default: "bg-foreground/80 text-background",
  danger: "bg-destructive text-destructive-foreground",
  success: "bg-leaf text-leaf-foreground",
};

/**
 * Universal listing card — the Amazon/Flipkart product tile, pet-first edition.
 * Used by Adopt, Mate, Services, Shop, Vets, Shelters.
 */
export const ListingCard = ({
  to,
  image,
  imageAlt,
  title,
  eyebrow,
  price,
  priceSuffix,
  mrp,
  priceLabel,
  city,
  distanceKm,
  rating,
  topLeftBadge,
  trustChips = [],
  healthChips = [],
  wishlistId,
  wishlistKind = "pet",
  cta,
  density = "compact",
  imageTag,
  className = "",
}: Props) => {
  const { user } = useAuth();
  const nav = useNavigate();

  const stop = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const onCtaClick = (e: MouseEvent) => {
    stop(e);
    if (!cta) return;
    if (cta.requiresAuth && !user) {
      nav(`/auth?next=${encodeURIComponent(to)}`);
      return;
    }
    cta.onClick?.();
  };

  const ctaLabel = cta?.requiresAuth && !user ? "Sign in to continue" : cta?.label;

  return (
    <Link
      to={to}
      className={`group relative flex flex-col rounded-2xl border border-hairline bg-card overflow-hidden transition-shadow hover:shadow-[var(--shadow-card)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${className}`}
    >
      {/* Hero */}
      <div className="relative aspect-[16/10] bg-muted overflow-hidden">
        {image ? (
          <LazyImage
            src={image}
            alt={imageAlt ?? title}
            className="h-full w-full object-cover transition-transform duration-500 motion-safe:group-hover:scale-[1.03]"
          />
        ) : (
          <div className="h-full w-full grid place-items-center text-muted-foreground text-xs">
            No photo
          </div>
        )}

        {topLeftBadge && (
          <div className="absolute top-2 left-2 max-w-[70%]">{topLeftBadge}</div>
        )}

        {imageTag && (
          <div
            className={`absolute bottom-2 left-2 text-[10px] font-semibold px-2 py-0.5 rounded-full ${TONE[imageTag.tone ?? "default"]}`}
          >
            {imageTag.label}
          </div>
        )}

        {wishlistId && user && (
          <div className="absolute top-2 right-2" onClickCapture={stop}>
            <WishlistButton listingId={wishlistId} />
          </div>
        )}
      </div>

      {/* Body */}
      <div className={`flex-1 flex flex-col gap-1.5 ${density === "compact" ? "p-3" : "p-4"}`}>
        {eyebrow && (
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">
            {eyebrow}
          </div>
        )}

        <h3 className="text-sm font-semibold leading-snug line-clamp-2">{title}</h3>

        {/* Price + location */}
        <div className="flex items-end justify-between gap-2 mt-0.5">
          <div className="min-w-0">
            {priceLabel ? (
              <span className="text-base font-semibold">{priceLabel}</span>
            ) : (
              <PriceTag value={price} suffix={priceSuffix} mrp={mrp} size="md" contactWhenNull />
            )}
          </div>
          <div className="flex flex-col items-end gap-0.5 shrink-0">
            {city && (
              <span className="text-[11px] text-muted-foreground truncate max-w-[110px]">{city}</span>
            )}
            <DistanceChip distanceKm={distanceKm ?? null} />
          </div>
        </div>

        {/* Rating */}
        {rating && rating.count > 0 && (
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-0.5 rounded-md bg-leaf-soft text-leaf font-semibold px-1.5 py-0.5">
              <Star className="h-2.5 w-2.5 fill-current" /> {rating.score.toFixed(1)}
            </span>
            <span>({rating.count})</span>
          </div>
        )}

        {/* Trust chips */}
        {trustChips.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {trustChips.map((k) => (
              <TrustChip key={k} kind={k} />
            ))}
          </div>
        )}

        {/* Health chips */}
        {healthChips.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {healthChips.map((k) => (
              <TrustChip key={`h-${k}`} kind={k} />
            ))}
          </div>
        )}

        {/* Spacer pushes CTA to bottom */}
        <div className="flex-1" />

        {cta && (
          <Button
            type="button"
            size="sm"
            variant={cta.variant ?? "default"}
            className="w-full rounded-full mt-2 h-9"
            onClick={onCtaClick}
          >
            {ctaLabel}
          </Button>
        )}
      </div>
    </Link>
  );
};

export default ListingCard;