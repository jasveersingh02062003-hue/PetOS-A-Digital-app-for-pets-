import { ShieldCheck, MapPin, ShieldAlert } from "lucide-react";

type PetSnapshot = {
  vaccines_ok?: boolean | null;
  city?: string | null;
  breed?: string | null;
  age_months?: number | null;
};

const formatAge = (months?: number | null) => {
  if (!months || months < 0) return null;
  if (months < 12) return `${months}mo`;
  const y = Math.floor(months / 12);
  return `${y}y`;
};

/**
 * Legacy trust strip — only rendered for ORG / non-pet posts where the pet
 * header isn't shown. For regular pet posts the credibility chips now live
 * directly in PetPostHeader (more prominent, less duplication).
 */
export const PostTrustStrip = ({ petSnapshot, force }: { petSnapshot?: PetSnapshot | null; force?: boolean }) => {
  if (!petSnapshot) return null;
  if (!force) return null; // suppressed by default; PetPostHeader renders these
  const chips: React.ReactNode[] = [];

  if (petSnapshot.vaccines_ok) {
    chips.push(
      <span key="vax" className="inline-flex items-center gap-1 rounded-full bg-leaf/15 text-leaf border border-leaf/40 px-2 py-0.5 text-[10px] font-semibold">
        <ShieldCheck className="h-3 w-3" /> Vaccinated
      </span>,
    );
  } else if (petSnapshot.vaccines_ok === false) {
    chips.push(
      <span key="novax" className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30 px-2 py-0.5 text-[10px] font-medium">
        <ShieldAlert className="h-3 w-3" /> Unverified
      </span>,
    );
  }

  const age = formatAge(petSnapshot.age_months);
  if (petSnapshot.breed || age) {
    chips.push(
      <span key="breed" className="inline-flex items-center gap-1 rounded-full bg-card text-foreground border-hairline px-2 py-0.5 text-[10px] font-medium">
        {[petSnapshot.breed, age].filter(Boolean).join(" · ")}
      </span>,
    );
  }
  if (petSnapshot.city) {
    chips.push(
      <span key="city" className="inline-flex items-center gap-1 rounded-full bg-card text-muted-foreground border-hairline px-2 py-0.5 text-[10px] font-medium">
        <MapPin className="h-3 w-3" /> {petSnapshot.city}
      </span>,
    );
  }
  if (!chips.length) return null;
  return <div className="flex items-center gap-1.5 flex-wrap px-4 pt-3 pb-1">{chips}</div>;
};

export default PostTrustStrip;
