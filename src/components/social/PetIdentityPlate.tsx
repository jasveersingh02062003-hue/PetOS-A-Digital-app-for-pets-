import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getRoleRing } from "@/lib/roleTheme";
import { cn } from "@/lib/utils";
import { MapPin, Flame, Footprints, Sparkles } from "lucide-react";
import { PawShield } from "./PawShield";

type PetSnapshot = {
  name?: string | null;
  breed?: string | null;
  age_months?: number | null;
  avatar_url?: string | null;
  vaccines_ok?: boolean | null;
  city?: string | null;
  lifetime_walks_km?: number | null;
  streak_days?: number | null;
  lineage_verified?: boolean | null;
};

const formatAge = (months?: number | null) => {
  if (!months || months < 0) return null;
  if (months < 12) return `${months}mo`;
  const y = Math.floor(months / 12);
  const m = months % 12;
  return m > 0 && y < 3 ? `${y}y ${m}mo` : `${y}y`;
};

/**
 * The Pet Identity Plate — a glass-morphism card that floats over the bottom
 * of the photo. This is the structural break from Instagram: the pet's
 * identity isn't a header above the image, it's stamped *onto* the moment.
 *
 * Renders the pet avatar (large, role-ringed), the pet name in display font,
 * breed + age inline, and a single trust line beneath: vaccinated · lineage ·
 * streak · walks · city. Designed to read top-to-bottom in two glances.
 */
export const PetIdentityPlate = ({
  petId,
  authorId,
  pet,
  petSnapshot,
  accountType = "pet_parent",
}: {
  petId?: string | null;
  authorId: string;
  pet?: { name: string; avatar_url: string | null } | null;
  petSnapshot?: PetSnapshot | null;
  accountType?: string | null;
}) => {
  const petName = pet?.name ?? petSnapshot?.name ?? null;
  const petAvatar = pet?.avatar_url ?? petSnapshot?.avatar_url ?? null;
  const breed = petSnapshot?.breed ?? null;
  const age = formatAge(petSnapshot?.age_months);
  if (!petName) return null;

  const ring = getRoleRing(accountType ?? "pet_parent");
  const linkTarget = petId ? `/pet/${petId}` : `/u/${authorId}`;
  const initial = petName[0]?.toUpperCase() ?? "P";

  const vaxOk = petSnapshot?.vaccines_ok === true;
  const vaxNo = petSnapshot?.vaccines_ok === false;
  const lineage = !!petSnapshot?.lineage_verified;
  const city = petSnapshot?.city;
  const walkKm = Number(petSnapshot?.lifetime_walks_km ?? 0);
  const streak = Number(petSnapshot?.streak_days ?? 0);
  const hasTrust = vaxOk || vaxNo || lineage || !!city || streak >= 3 || walkKm >= 1;

  return (
    <Link
      to={linkTarget}
      className={cn(
        "absolute left-3 right-3 bottom-3 z-10 group",
        "rounded-2xl bg-card/85 backdrop-blur-xl",
        "ring-1 ring-white/30 dark:ring-white/10",
        "shadow-[0_4px_24px_-4px_rgba(0,0,0,0.25)]",
        "px-3 py-2.5 flex items-center gap-3",
        "active:scale-[0.99] transition-transform"
      )}
    >
      <Avatar className={cn("h-12 w-12 ring-2 ring-offset-2 ring-offset-card shrink-0", ring)}>
        <AvatarImage src={petAvatar ?? undefined} alt={petName} />
        <AvatarFallback className="bg-primary-soft text-primary text-base font-semibold">{initial}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1.5 min-w-0 flex-wrap">
          <span className="font-display text-[18px] font-semibold leading-none text-foreground tracking-tight truncate">
            {petName}
          </span>
          {(breed || age) && (
            <span className="text-[12px] text-muted-foreground truncate">
              {[breed, age].filter(Boolean).join(" · ")}
            </span>
          )}
        </div>
        {hasTrust && (
          <div className="flex items-center gap-2 mt-1 text-[11px] flex-wrap">
            {vaxOk && (
              <span className="inline-flex items-center gap-0.5 text-leaf font-semibold">
                <PawShield className="h-3 w-3" /> Vaccinated
              </span>
            )}
            {vaxNo && (
              <span className="inline-flex items-center gap-0.5 text-amber-600 dark:text-amber-400">
                Unverified
              </span>
            )}
            {lineage && (
              <span className="inline-flex items-center gap-0.5 text-coral font-semibold">
                <Sparkles className="h-3 w-3" /> Lineage
              </span>
            )}
            {streak >= 3 && (
              <span className="inline-flex items-center gap-0.5 text-orange-500">
                <Flame className="h-3 w-3" /> {streak}d
              </span>
            )}
            {walkKm >= 1 && (
              <span className="inline-flex items-center gap-0.5 text-muted-foreground">
                <Footprints className="h-3 w-3" /> {walkKm < 10 ? walkKm.toFixed(1) : Math.round(walkKm)}km
              </span>
            )}
            {city && (
              <span className="inline-flex items-center gap-0.5 text-muted-foreground">
                <MapPin className="h-3 w-3" /> {city}
              </span>
            )}
          </div>
        )}
      </div>
    </Link>
  );
};

export default PetIdentityPlate;
