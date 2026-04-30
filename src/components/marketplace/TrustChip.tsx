import {
  BadgeCheck,
  Sparkles,
  ShieldCheck,
  Syringe,
  Pill,
  Microscope,
  Heart,
  Cpu,
  Award,
} from "lucide-react";

export type TrustChipKind =
  | "verified"
  | "bred-on-petos"
  | "kyc"
  | "vaccinated"
  | "dewormed"
  | "microchipped"
  | "health-tested"
  | "spayed"
  | "champion";

const META: Record<TrustChipKind, { label: string; Icon: any; tone: string }> = {
  verified:        { label: "Verified",        Icon: BadgeCheck,  tone: "bg-leaf-soft text-leaf border-leaf/30" },
  "bred-on-petos": { label: "Bred on PetOS",   Icon: Sparkles,    tone: "bg-coral-soft text-coral border-coral/30" },
  kyc:             { label: "KYC verified",    Icon: ShieldCheck, tone: "bg-primary-soft text-primary border-primary/30" },
  vaccinated:      { label: "Vaccinated",      Icon: Syringe,     tone: "bg-sky-soft text-sky border-sky/30" },
  dewormed:        { label: "Dewormed",        Icon: Pill,        tone: "bg-amber-soft text-amber-foreground border-amber/30" },
  microchipped:    { label: "Microchipped",    Icon: Cpu,         tone: "bg-lilac-soft text-lilac border-lilac/30" },
  "health-tested": { label: "Health-tested",   Icon: Microscope,  tone: "bg-leaf-soft text-leaf border-leaf/30" },
  spayed:          { label: "Spayed/Neutered", Icon: Heart,       tone: "bg-coral-soft text-coral border-coral/30" },
  champion:        { label: "Champion line",   Icon: Award,       tone: "bg-amber-soft text-amber-foreground border-amber/30" },
};

type Props = {
  kind: TrustChipKind;
  /** Override label (e.g. "DHPP + Rabies") */
  label?: string;
  size?: "xs" | "sm";
  className?: string;
};

/** Single source of truth for the small trust/health pills shown on cards. */
export const TrustChip = ({ kind, label, size = "xs", className = "" }: Props) => {
  const m = META[kind];
  const Icon = m.Icon;
  const sizing =
    size === "xs"
      ? "text-[10px] px-1.5 h-5 gap-0.5"
      : "text-xs px-2 h-6 gap-1";
  return (
    <span
      className={`inline-flex items-center rounded-full border font-medium whitespace-nowrap ${m.tone} ${sizing} ${className}`}
    >
      <Icon className={size === "xs" ? "h-2.5 w-2.5" : "h-3 w-3"} />
      {label ?? m.label}
    </span>
  );
};