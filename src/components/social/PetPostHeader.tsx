import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getRoleRing } from "@/lib/roleTheme";
import { cn } from "@/lib/utils";
import { UserStreakChip } from "./UserStreakChip";
import { SellerBadge } from "@/components/SellerBadge";

type PetSnapshot = {
  name?: string | null;
  breed?: string | null;
  age_months?: number | null;
  avatar_url?: string | null;
  vaccines_ok?: boolean | null;
  city?: string | null;
};

interface Props {
  authorId: string;
  authorName?: string | null;
  authorAvatar?: string | null;
  accountType?: string | null;
  petId?: string | null;
  /** Live pet object (from join) */
  pet?: { name: string; avatar_url: string | null } | null;
  /** Denormalized snapshot stored on the post */
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
 * Pet-first post header. Shows the pet as the protagonist with breed + age,
 * and the human as the secondary "by @owner" subline. Falls back gracefully
 * when there's no pet linked (org posts, generic moments).
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

  return (
    <div className="flex items-start gap-3 p-4">
      <Link to={linkTarget} className="shrink-0">
        <Avatar className={cn("h-11 w-11 ring-2 ring-offset-2 ring-offset-background", ring)}>
          <AvatarImage src={displayImg} alt={displayName} />
          <AvatarFallback className="bg-primary-soft text-primary text-sm font-medium">{initial}</AvatarFallback>
        </Avatar>
      </Link>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
          <Link
            to={linkTarget}
            className="text-[15px] font-semibold leading-tight truncate hover:underline"
          >
            {displayName}
          </Link>
          {isPetCard && (breed || age) && (
            <span className="text-xs text-muted-foreground truncate">
              · {[breed, age].filter(Boolean).join(" · ")}
            </span>
          )}
          {!isPetCard && accountType !== "pet_parent" && (
            <SellerBadge type={accountType as any} verified={!!authorVerified} pending={!!authorPending} />
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground">
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
