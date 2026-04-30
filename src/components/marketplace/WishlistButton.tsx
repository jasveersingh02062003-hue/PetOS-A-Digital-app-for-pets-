import { Heart } from "lucide-react";
import { useWishlistIds, useToggleWishlist, type WishlistKind } from "@/hooks/useWishlist";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";

export const WishlistButton = ({
  listingId,
  kind = "pet",
  className = "",
}: { listingId: string; kind?: WishlistKind; className?: string }) => {
  const { user } = useAuth();
  const nav = useNavigate();
  const { data: ids } = useWishlistIds(kind);
  const toggle = useToggleWishlist();
  const saved = ids?.has(listingId) ?? false;

  return (
    <button
      type="button"
      aria-label={saved ? "Remove from wishlist" : "Save to wishlist"}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!user) { nav("/auth"); return; }
        toggle.mutate({ listingId, isSaved: saved, kind });
      }}
      className={`h-8 w-8 rounded-full bg-background/90 backdrop-blur grid place-items-center shadow-sm border border-hairline active:scale-95 transition ${className}`}
    >
      <Heart
        className={`h-4 w-4 ${saved ? "text-coral" : "text-muted-foreground"}`}
        fill={saved ? "currentColor" : "none"}
      />
    </button>
  );
};
