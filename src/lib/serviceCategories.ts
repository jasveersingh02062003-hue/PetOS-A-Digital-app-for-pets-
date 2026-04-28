import {
  Scissors, GraduationCap, Footprints, Heart, Hotel, Stethoscope,
  Sun, Car, Home, type LucideIcon,
} from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

export type ServiceCategory = Database["public"]["Enums"]["service_category"];

export type ServiceCategoryMeta = {
  key: ServiceCategory;
  label: string;
  short: string;
  description: string;
  icon: LucideIcon;
  tone: "coral" | "sky" | "leaf" | "amber" | "lilac" | "primary";
};

export const SERVICE_CATEGORIES: ServiceCategoryMeta[] = [
  { key: "grooming",  label: "Grooming",       short: "Grooming",  description: "Baths, haircuts, nail trims and spa", icon: Scissors,    tone: "coral" },
  { key: "vet_clinic",label: "Vet clinics",    short: "Vet clinic",description: "In-person vet clinics near you",      icon: Stethoscope, tone: "sky" },
  { key: "training",  label: "Training",       short: "Training",  description: "Obedience, behaviour and puppy schools", icon: GraduationCap, tone: "amber" },
  { key: "boarding",  label: "Boarding",       short: "Boarding",  description: "Overnight stays in trusted facilities",  icon: Hotel,       tone: "lilac" },
  { key: "daycare",   label: "Daycare",        short: "Daycare",   description: "Daytime drop-off care while you're out", icon: Sun,         tone: "amber" },
  { key: "caretaker", label: "Caretakers",     short: "Caretaker", description: "Long-term in-home care for your pet",    icon: Home,        tone: "leaf" },
  { key: "sitting",   label: "Sitters",        short: "Sitter",    description: "Short visits, drop-ins and check-ups",   icon: Heart,       tone: "coral" },
  { key: "walking",   label: "Walkers",        short: "Walker",    description: "Daily walks and exercise",               icon: Footprints,  tone: "leaf" },
  { key: "pet_taxi",  label: "Pet taxi",       short: "Pet taxi",  description: "Safe transport and pickups",             icon: Car,         tone: "primary" },
];

export const TONE_BG: Record<string, string> = {
  coral:   "bg-coral/10 text-coral",
  sky:     "bg-sky/10 text-sky",
  leaf:    "bg-leaf/10 text-leaf",
  amber:   "bg-amber/15 text-amber",
  lilac:   "bg-lilac/10 text-lilac",
  primary: "bg-primary/10 text-primary",
};

export function getCategoryMeta(key: ServiceCategory | string): ServiceCategoryMeta | undefined {
  return SERVICE_CATEGORIES.find((c) => c.key === key);
}