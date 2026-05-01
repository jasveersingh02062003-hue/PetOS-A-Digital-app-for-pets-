import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getRoleRing } from "@/lib/roleTheme";
import { cn } from "@/lib/utils";
import { UserStreakChip } from "./UserStreakChip";
import { SellerBadge } from "@/components/SellerBadge";
import { MapPin, Flame, Footprints } from "lucide-react";
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

interface Props {
  authorId: string;
  authorName?: string | null;
  authorAvatar?: string | null;
  accountType?: string | null;
  petId?: string | null;
  pet?: { name: string; avatar_url: string | null } | null;
  petSnapshot?: PetSnapshot | null;
  createdAt: string;
  authorVerified?: boolean;
  authorPending?: boolean;
}

const formatAge = (months?: number | null) => {
  if (!months || months < 0) return null;
  if (months < 12) return `${months}mo`;
  const y = Math.floor(months / 12);
  const m = months % 12;
  return m > 0 && y < 3 ? `${y}y ${m}mo` : `${y}y`;
};

/**
 * Pet-first post header — premium edition.
 * The pet is the protagonist: large avatar with role-ring, display-font name,
 * and an inline "Pet Passport" credibility row (vaccines, lineage, locality,
 * lifetime walks, care streak). The owner is intentionally a smaller subline.
 */
export const PetPostHeader = ({
  authorId,
  authorName,
  authorAvatar,
  accountType = "pet_parent",
  petId,
  pet,
  petSnapshot,
  createdAt,
  authorVerified,
  authorPending,
}: Props) => {
  const petName = pet?.name ?? petSnapshot?.name ?? null;
  const petAvatar = pet?.avatar_url ?? petSnapshot?.avatar_url ?? null;
  const breed = petSnapshot?.breed ?? null;
  const age = formatAge(petSnapshot?.age_months);

  const displayName = petName ?? authorName ?? "Pet parent";
  const displayImg = petAvatar ?? authorAvatar ?? undefined;
  const initial = displayName[0]?.toUpperCase() ?? "P";
  const isPetCard = !!petName;

  const ring = getRoleRing(accountType ?? "pet_parent");
  const linkTarget = petId ? `/pet/${petId}` : `/u/${authorId}`;
  const timeAgo = formatDistanceToNow(new Date(createdAt), { addSuffix: true });

  const vaxOk = petSnapshot?.vaccines_ok === true;
  const vaxNo = petSnapshot?.vaccines_ok === false;
  const lineage = !!petSnapshot?.lineage_verified;
  const city = petSnapshot?.city;
  const walkKm = Number(petSnapshot?.lifetime_walks_km ?? 0);
  const streak = Number(petSnapshot?.streak_days ?? 0);

  return (
    <div className="flex items-start gap-3 px-4 pt-4 pb-3">
      <Link to={linkTarget} className="shrink-0">
        <Avatar className={cn("h-14 w-14 ring-2 ring-offset-2 ring-offset-background", ring)}>
          <AvatarImage src={displayImg} alt={displayName} />
          <AvatarFallback className="bg-primary-soft text-primary text-base font-medium">{initial}</AvatarFallback>
        </Avatar>
      </Link>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1.5 min-w-0 flex-wrap">
          <Link
            to={linkTarget}
            className="font-display text-[19px] leading-tight font-semibold truncate hover:underline tracking-tight"
          >
            {displayName}
          </Link>
          {isPetCard && (breed || age) && (
            <span className="text-[12px] text-muted-foreground truncate">
              {[breed, age].filter(Boolean).join(" · ")}
            </span>
          )}
          {!isPetCard && accountType !== "pet_parent" && (
            <SellerBadge type={accountType as any} verified={!!authorVerified} pending={!!authorPending} />
          )}
        </div>

        {/* Pet Passport credibility row — what IG can never show */}
        {isPetCard && (vaxOk || vaxNo || lineage || city || streak >= 3 || walkKm >= 1) && (
          <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
            {vaxOk && (
              <span className="inline-flex items-center gap-1 rounded-full bg-leaf/12 text-leaf border border-leaf/30 px-2 py-0.5 text-[10.5px] font-semibold">
                <PawShield className="h-3 w-3" /> Vaccinated
              </span>
            )}
            {vaxNo && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30 px-2 py-0.5 text-[10.5px] font-medium">
                Unverified
              </span>
            )}
            {lineage && (
              <span className="inline-flex items-center gap-1 rounded-full bg-coral/10 text-coral border border-coral/30 px-2 py-0.5 text-[10.5px] font-semibold">
                ✦ Lineage
              </span>
            )}
            {streak >= 3 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/25 px-2 py-0.5 text-[10.5px] font-semibold">
                <Flame className="h-3 w-3" /> {streak}d
              </span>
            )}
            {walkKm >= 1 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-card text-muted-foreground border-hairline px-2 py-0.5 text-[10.5px] font-medium">
                <Footprints className="h-3 w-3" /> {walkKm < 10 ? walkKm.toFixed(1) : Math.round(walkKm)}km
              </span>
            )}
            {city && (
              <span className="inline-flex items-center gap-1 rounded-full bg-card text-muted-foreground border-hairline px-2 py-0.5 text-[10.5px] font-medium">
                <MapPin className="h-3 w-3" /> {city}
              </span>
            )}
          </div>
        )}

        <div className="flex items-center gap-2 mt-1.5 text-[11px] text-muted-foreground">
          {isPetCard && (
            <>
              <Link to={`/u/${authorId}`} className="hover:underline truncate max-w-[40%]">
                by {authorName ?? "owner"}
              </Link>
              <span>·</span>
            </>
          )}
          <span>{timeAgo}</span>
          {accountType === "pet_parent" && (
            <UserStreakChip
              userId={authorId}
              minStreak={3}
              className="text-[10px] py-0 px-1.5 h-4"
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default PetPostHeader;
