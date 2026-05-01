import { ShieldCheck, MapPin } from "lucide-react";

type PetSnapshot = {
  vaccines_ok?: boolean | null;
  city?: string | null;
};

/**
 * Trust + locality signals shown beneath the post image.
 * Only renders chips for which we have data — never an empty bar.
 *
 * This is unique to Petos: Instagram has none of this.
 */
export const PostTrustStrip = ({ petSnapshot }: { petSnapshot?: PetSnapshot | null }) => {
  if (!petSnapshot) return null;
  const chips: React.ReactNode[] = [];
  if (petSnapshot.vaccines_ok) {
    chips.push(
      <span
        key="vax"
        className="inline-flex items-center gap-1 rounded-full bg-leaf/10 text-leaf border border-leaf/30 px-2 py-0.5 text-[10px] font-semibold"
        title="Vaccinations recorded in the last 12 months"
      >
        <ShieldCheck className="h-3 w-3" /> Vaccines up-to-date
      </span>,
    );
  }
  if (petSnapshot.city) {
    chips.push(
      <span
        key="city"
        className="inline-flex items-center gap-1 rounded-full bg-muted text-muted-foreground px-2 py-0.5 text-[10px] font-medium"
      >
        <MapPin className="h-3 w-3" /> {petSnapshot.city}
      </span>,
    );
  }
  if (!chips.length) return null;
  return <div className="flex items-center gap-1.5 flex-wrap px-4 pt-2">{chips}</div>;
};

export default PostTrustStrip;
