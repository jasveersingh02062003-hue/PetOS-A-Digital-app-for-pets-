import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Heart } from "lucide-react";
import { useWishlistList } from "@/hooks/useWishlist";
import { SmartImage } from "@/components/SmartImage";

export const WishlistList = ({ userId }: { userId: string }) => {
  const { data, isLoading } = useWishlistList(userId);

  if (isLoading) return <div className="text-sm text-muted-foreground py-6 text-center">Loading…</div>;
  if (!data?.length) {
    return (
      <div className="text-center text-sm text-muted-foreground py-10">
        <Heart className="h-6 w-6 mx-auto mb-2 opacity-50" />
        Nothing saved yet. Tap the heart on a listing to add it.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      {data.map((row: any) => {
        const l = row.listing;
        if (!l) return null;
        const photo = (l.photos as string[] | null)?.[0];
        const isFree = l.listing_type === "adoption" || !l.fee_inr;
        return (
          <Link
            key={row.id}
            to={`/mates/adopt/${l.id}`}
            className="rounded-2xl overflow-hidden border border-hairline bg-card"
          >
            <div className="aspect-square bg-muted">
              {photo && <SmartImage src={photo} alt={l.title} aspect="1/1" className="w-full h-full" />}
            </div>
            <div className="p-2.5">
              <div className="text-sm font-medium truncate">{l.title}</div>
              <div className="text-[11px] text-muted-foreground truncate">
                {l.city ?? "—"}
              </div>
              <div className="text-xs font-semibold mt-1">
                {isFree ? <span className="text-leaf">Free</span> : <span className="text-primary">₹{l.fee_inr.toLocaleString("en-IN")}</span>}
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
};
