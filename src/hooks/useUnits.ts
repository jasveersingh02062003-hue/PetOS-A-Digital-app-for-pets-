import { useProfile } from "./useProfile";

export type WeightUnit = "kg" | "lb";
export type TempUnit = "c" | "f";

const KG_TO_LB = 2.2046226218;

export const useUnits = () => {
  const { data: profile } = useProfile();
  const u = (profile as any)?.units ?? {};
  const weight: WeightUnit = u.weight === "lb" ? "lb" : "kg";
  const temp: TempUnit = u.temp === "f" ? "f" : "c";

  const formatWeight = (kg: number | null | undefined, opts?: { precision?: number; unit?: boolean }) => {
    if (kg == null || isNaN(Number(kg))) return "—";
    const p = opts?.precision ?? 1;
    const showUnit = opts?.unit ?? true;
    const v = weight === "lb" ? Number(kg) * KG_TO_LB : Number(kg);
    return `${v.toFixed(p)}${showUnit ? ` ${weight}` : ""}`;
  };

  const formatTemp = (c: number | null | undefined, opts?: { precision?: number; unit?: boolean }) => {
    if (c == null || isNaN(Number(c))) return "—";
    const p = opts?.precision ?? 1;
    const showUnit = opts?.unit ?? true;
    const v = temp === "f" ? (Number(c) * 9) / 5 + 32 : Number(c);
    return `${v.toFixed(p)}${showUnit ? `°${temp.toUpperCase()}` : ""}`;
  };

  /** Take a number the user typed in their preferred unit and return kg for storage. */
  const parseWeightToKg = (input: string | number): number | null => {
    const n = typeof input === "number" ? input : parseFloat(input);
    if (isNaN(n)) return null;
    return weight === "lb" ? n / KG_TO_LB : n;
  };

  /** Convert a kg value into the user's display unit number (no formatting). */
  const kgToDisplay = (kg: number | null | undefined): number | null => {
    if (kg == null || isNaN(Number(kg))) return null;
    return weight === "lb" ? Number(kg) * KG_TO_LB : Number(kg);
  };

  return {
    weightUnit: weight,
    tempUnit: temp,
    formatWeight,
    formatTemp,
    parseWeightToKg,
    kgToDisplay,
  };
};