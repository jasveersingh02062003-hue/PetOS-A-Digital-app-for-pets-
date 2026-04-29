import { Link } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SellerBadge } from "@/components/SellerBadge";
import { useIsVerifiedOrg } from "@/hooks/useVerifiedOrgs";
import { usePublicProfiles } from "@/hooks/usePublicProfiles";
import { useOrgIdentity } from "@/hooks/useOrgIdentities";
import { useIsHelpfulVet } from "@/hooks/useHelpfulVetIds";
import { useProviderCategory } from "@/hooks/useProviderCategory";
import { getRoleRing } from "@/lib/roleTheme";
import { cn } from "@/lib/utils";
import { Stethoscope } from "lucide-react";

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
  /** Show only the role-tinted avatar (no name/badge). */
  avatarOnly?: boolean;
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
const ORG_ROLES = new Set(["breeder", "kennel", "shelter", "sanctuary", "zoo"]);

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
  avatarOnly = false,
}: Props) => {
  const { data: profiles } = usePublicProfiles();
  const profile = profiles?.find((p) => p.id === userId);
  const verified = useIsVerifiedOrg(userId);
  const isHelpfulVet = useIsHelpfulVet(userId);
  const org = useOrgIdentity(userId);

  const accountType = (profile?.account_type ?? fallbackAccountType ?? "pet_parent") as string;
  const providerCategory = useProviderCategory(userId, accountType === "service_provider");
  const personalName = profile?.full_name ?? fallbackName ?? "Member";
  const personalAvatar = profile?.avatar_url ?? fallbackAvatar ?? undefined;

  // Org-as-author: for org-type accounts with a registered org_profiles row,
  // surface the org name and logo. Personal name moves to the subline.
  const useOrg = ORG_ROLES.has(accountType) && !!org?.org_name;
  const name = useOrg ? (org!.org_name as string) : personalName;
  const avatar = useOrg ? (org!.logo_url ?? personalAvatar) : personalAvatar;
  const effectiveSubline =
    subline ??
    (useOrg ? <>Managed by {personalName}</> : null);

  const ring = getRoleRing(accountType);
  const s = SIZE[size];

  const inner = (
    <div className={cn("flex items-center", s.gap, className)}>
      <Avatar className={cn(s.avatar, "ring-2 ring-offset-2 ring-offset-background", ring)}>
        {avatar ? <AvatarImage src={avatar} alt={name} /> : null}
        <AvatarFallback>{name.slice(0, 1).toUpperCase()}</AvatarFallback>
      </Avatar>
      {!avatarOnly && (
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className={cn(s.name, "truncate")}>{name}</span>
        </div>
        {showBadge && (
          <div className="mt-0.5">
            <span className="inline-flex items-center gap-1">
              <SellerBadge type={accountType as any} verified={verified} />
              {accountType === "vet" && isHelpfulVet && (
                <span
                  className="inline-flex items-center gap-0.5 text-[9px] font-bold text-leaf bg-leaf/10 border border-leaf/30 rounded-full px-1.5 py-0.5"
                  title="Helpful vet"
                >
                  <Stethoscope className="h-2.5 w-2.5" /> Helpful
                </span>
              )}
              {accountType === "service_provider" && providerCategory && (
                <span
                  className="inline-flex items-center text-[9px] font-semibold text-sky bg-sky/10 border border-sky/30 rounded-full px-1.5 py-0.5 capitalize"
                  title={providerCategory}
                >
                  {providerCategory}
                </span>
              )}
            </span>
          </div>
        )}
        {effectiveSubline ? <div className="text-xs text-muted-foreground truncate">{effectiveSubline}</div> : null}
      </div>
      )}
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
