/**
 * Single source of truth for role-based visual treatment.
 * - Avatar ring colour shown on every <AuthorIdentity>.
 * - Header banner tint for role-aware UserProfile / dashboards.
 *
 * Tailwind classes (HSL semantic tokens preferred where they exist).
 */
export type AccountType =
  | "pet_parent"
  | "breeder"
  | "kennel"
  | "shelter"
  | "sanctuary"
  | "zoo"
  | "rescuer"
  | "buyer";

const RING: Record<AccountType, string> = {
  pet_parent: "ring-primary/40",
  breeder: "ring-amber-500/60",
  kennel: "ring-sky/60",
  shelter: "ring-lilac/60",
  sanctuary: "ring-leaf/60",
  zoo: "ring-stone-500/60",
  rescuer: "ring-coral/60",
  buyer: "ring-primary/40",
};

const BANNER: Record<AccountType, string> = {
  pet_parent: "bg-primary/5",
  breeder: "bg-amber-500/10",
  kennel: "bg-sky/10",
  shelter: "bg-lilac/10",
  sanctuary: "bg-leaf/10",
  zoo: "bg-stone-500/10",
  rescuer: "bg-coral/10",
  buyer: "bg-primary/5",
};

export const getRoleRing = (t?: AccountType | string | null) =>
  RING[(t ?? "pet_parent") as AccountType] ?? RING.pet_parent;

export const getRoleBanner = (t?: AccountType | string | null) =>
  BANNER[(t ?? "pet_parent") as AccountType] ?? BANNER.pet_parent;

/** Roles that are organisations (eligible for verified tick + org branding). */
export const ORG_ROLES: AccountType[] = [
  "breeder",
  "kennel",
  "shelter",
  "sanctuary",
  "zoo",
  "rescuer",
];

export const isOrgRole = (t?: AccountType | string | null) =>
  ORG_ROLES.includes((t ?? "pet_parent") as AccountType);
