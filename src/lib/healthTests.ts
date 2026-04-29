/**
 * Catalog of common pet-health screening tests that breeders can attest to on
 * a listing. Lives client-side for now — when the verified-vet attestation
 * flow lands in a later round, this can move to a `health_test_catalog`
 * table without changing the chip UX.
 */
export type HealthTestCode =
  | "hips_ofa"
  | "elbows_ofa"
  | "eyes_cerf"
  | "cardiac"
  | "patella"
  | "dna_pra"
  | "dna_dm"
  | "brucella";

export type HealthTestDef = {
  code: HealthTestCode;
  label: string;
  /** Suggested result chips, in roughly best→worst order. */
  results: string[];
  species?: ("dog" | "cat")[];
};

export const HEALTH_TESTS: HealthTestDef[] = [
  { code: "hips_ofa",   label: "Hips OFA",      results: ["Excellent", "Good", "Fair", "Borderline"], species: ["dog"] },
  { code: "elbows_ofa", label: "Elbows OFA",    results: ["Normal", "Grade 1", "Grade 2"],            species: ["dog"] },
  { code: "eyes_cerf",  label: "Eyes CERF",     results: ["Clear", "Suspicious"],                     species: ["dog", "cat"] },
  { code: "cardiac",    label: "Cardiac",       results: ["Normal", "Murmur"],                        species: ["dog", "cat"] },
  { code: "patella",    label: "Patella",       results: ["Normal", "Grade 1", "Grade 2"],            species: ["dog"] },
  { code: "dna_pra",    label: "DNA PRA",       results: ["Clear", "Carrier", "Affected"],            species: ["dog", "cat"] },
  { code: "dna_dm",     label: "DNA DM",        results: ["Clear", "Carrier", "Affected"],            species: ["dog"] },
  { code: "brucella",   label: "Brucella",      results: ["Negative"],                                species: ["dog"] },
];

export type HealthTestEntry = {
  code: HealthTestCode | string;
  label: string;
  result: string;
  verified_by?: string;
  verified_at?: string;
};

export const findTest = (code: string) => HEALTH_TESTS.find((t) => t.code === code);

/** Best-guess tone for a result string. Used by the chip. */
export const resultTone = (result: string): "good" | "warn" | "neutral" => {
  const r = result.toLowerCase();
  if (/excellent|good|normal|clear|negative/.test(r)) return "good";
  if (/borderline|suspicious|carrier|grade\s*1|murmur|fair/.test(r)) return "warn";
  if (/affected|grade\s*2|grade\s*3/.test(r)) return "warn";
  return "neutral";
};