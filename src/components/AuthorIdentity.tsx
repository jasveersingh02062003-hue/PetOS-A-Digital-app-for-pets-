import { Link } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SellerBadge } from "@/components/SellerBadge";
import { useIsVerifiedOrg } from "@/hooks/useVerifiedOrgs";
import { usePublicProfiles } from "@/hooks/usePublicProfiles";
import { getRoleRing } from "@/lib/roleTheme";
import { cn } from "@/lib/utils";

type Size = "sm" | "md" | "lg";

const SIZE: Record<Size, { avatar: string; name: string; gap: string }> = {
  sm: { avatar: "h-7 w-7", name: "text-xs font-medium", gap: "gap-2" },
  md: { avatar: "h-9 w-9", name: "text-sm font-semibold", gap: "gap-2.5" },
  lg: { avatar: "h-12 w-12", name: "text-base font-semibold", gap: "gap-3" },
};

interface Props {
  userId: string;
  /** Override fetched profile fields if the caller already has them (post header etc.). */
  fallbackName?: string | null;
  fallbackAvatar?: string | null;
  fallbackAccountType?: string | null;
  size?: Size;
  showBadge?: boolean;
  /** Render as a Link to the user profile (default true). */
  linkTo?: string | false;
  className?: string;
  subline?: React.ReactNode;
}

/**
 * Single source of truth for author rendering across the app.
 * - Pulls public profile data from the shared cached RPC.
 * - Applies a role-tinted ring on the avatar.
 * - Shows the role <SellerBadge> with auto-verified tick when the org_profiles is approved.
 *
 * Use this everywhere a user appears (post header, comments, stories, search,
 * notifications, grids). Do not render avatar+name+badge by hand.
 */
export const AuthorIdentity = ({
  userId,
  fallbackName,
  fallbackAvatar,
  fallbackAccountType,
  size = "md",
  showBadge = true,
  linkTo,
  className,
  subline,
}: Props) => {
  const { data: profiles } = usePublicProfiles();
  const profile = profiles?.find((p) => p.id === userId);
  const verified = useIsVerifiedOrg(userId);

  const name = profile?.full_name ?? fallbackName ?? "Member";
  const avatar = profile?.avatar_url ?? fallbackAvatar ?? undefined;
  const accountType = (profile?.account_type ?? fallbackAccountType ?? "pet_parent") as any;
  const ring = getRoleRing(accountType);
  const s = SIZE[size];

  const inner = (
    <div className={cn("flex items-center", s.gap, className)}>
      <Avatar className={cn(s.avatar, "ring-2 ring-offset-2 ring-offset-background", ring)}>
        {avatar ? <AvatarImage src={avatar} alt={name} /> : null}
        <AvatarFallback>{name.slice(0, 1).toUpperCase()}</AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className={cn(s.name, "truncate")}>{name}</span>
        </div>
        {showBadge && (
          <div className="mt-0.5">
            <SellerBadge type={accountType} verified={verified} />
          </div>
        )}
        {subline ? <div className="text-xs text-muted-foreground truncate">{subline}</div> : null}
      </div>
    </div>
  );

  if (linkTo === false) return inner;
  return (
    <Link to={linkTo ?? `/u/${userId}`} className="hover:opacity-90 transition-opacity">
      {inner}
    </Link>
  );
};

export default AuthorIdentity;
