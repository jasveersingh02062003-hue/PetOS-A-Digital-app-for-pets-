import { ReactNode } from "react";

/** Color-coded avatar ring per Petos role. Uses semantic tokens from index.css. */
export type Role = "breeder" | "shelter" | "vet" | "walker" | "groomer" | "kennel" | "rescuer" | "sanctuary" | "zoo" | "buyer" | "pet_parent";

const ROLE_COLOR: Record<Role, string> = {
  breeder: "ring-amber",
  shelter: "ring-lilac",
  vet: "ring-leaf",
  walker: "ring-sky",
  groomer: "ring-coral",
  kennel: "ring-sky",
  rescuer: "ring-coral",
  sanctuary: "ring-leaf",
  zoo: "ring-amber",
  buyer: "ring-primary",
  pet_parent: "ring-muted-foreground",
};

const SIZE: Record<"sm" | "md" | "lg", string> = {
  sm: "p-0.5",
  md: "p-[3px]",
  lg: "p-1",
};

type Props = {
  role?: Role | null;
  size?: "sm" | "md" | "lg";
  children: ReactNode;
  className?: string;
};

/** Wrap any avatar to give it a per-role colored ring. */
export const RoleRing = ({ role, size = "md", children, className = "" }: Props) => {
  const color = ROLE_COLOR[(role ?? "pet_parent") as Role] ?? ROLE_COLOR.pet_parent;
  return (
    <span
      className={`inline-flex rounded-full bg-card ${SIZE[size]} ring-2 ${color}/70 ${className}`}
      aria-hidden={!role}
    >
      {children}
    </span>
  );
};