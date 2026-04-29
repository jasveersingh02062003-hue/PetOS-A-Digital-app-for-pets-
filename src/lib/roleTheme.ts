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

/** Submit / primary action button class per role. */
const SUBMIT: Record<AccountType, string> = {
  pet_parent: "bg-coral text-coral-foreground hover:bg-coral/90",
  breeder: "bg-amber-500 text-white hover:bg-amber-500/90",
  kennel: "bg-sky text-sky-foreground hover:bg-sky/90",
  shelter: "bg-lilac text-lilac-foreground hover:bg-lilac/90",
  sanctuary: "bg-leaf text-leaf-foreground hover:bg-leaf/90",
  zoo: "bg-stone-600 text-white hover:bg-stone-600/90",
  rescuer: "bg-coral text-coral-foreground hover:bg-coral/90",
  buyer: "bg-primary text-primary-foreground hover:bg-primary/90",
};

export const getRoleSubmit = (t?: AccountType | string | null) =>
  SUBMIT[(t ?? "pet_parent") as AccountType] ?? SUBMIT.pet_parent;

/** Composer copy hint per role — placeholder & CTA. */
const COPY: Record<AccountType, { placeholder: string; cta: string }> = {
  pet_parent: { placeholder: "What's your pet up to?", cta: "Share" },
  breeder: { placeholder: "Share a litter update or stud news…", cta: "Post update" },
  kennel: { placeholder: "Share boarding news, slots, or photos…", cta: "Post update" },
  shelter: { placeholder: "Share an adoption story or appeal…", cta: "Post update" },
  sanctuary: { placeholder: "Share a rescue or sanctuary moment…", cta: "Post update" },
  zoo: { placeholder: "Share keeper notes, events, or sightings…", cta: "Post update" },
  rescuer: { placeholder: "Share a rescue, alert, or success story…", cta: "Post update" },
  buyer: { placeholder: "Looking for a pet? Share what you're after…", cta: "Post" },
};

export const getRoleComposerCopy = (t?: AccountType | string | null) =>
  COPY[(t ?? "pet_parent") as AccountType] ?? COPY.pet_parent;

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
