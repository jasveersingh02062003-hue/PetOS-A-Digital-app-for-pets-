import { describe, it, expect } from "vitest";
import { BREEDS, TEMPERAMENT_TAGS, COMMON_ALLERGIES, COMMON_CONDITIONS, GOALS } from "@/lib/breeds";

describe("breeds catalog", () => {
  it("covers every species we accept in the UI", () => {
    for (const sp of ["dog", "cat", "bird", "rabbit", "other"]) {
      expect(BREEDS[sp]).toBeDefined();
      expect(BREEDS[sp].length).toBeGreaterThan(0);
    }
  });

  it("breed lists contain no empty strings or duplicates", () => {
    for (const list of Object.values(BREEDS)) {
      const seen = new Set<string>();
      for (const b of list) {
        expect(b).toBeTruthy();
        expect(seen.has(b)).toBe(false);
        seen.add(b);
      }
    }
  });

  it("temperament/allergy/condition tags are non-empty", () => {
    expect(TEMPERAMENT_TAGS.length).toBeGreaterThan(0);
    expect(COMMON_ALLERGIES.length).toBeGreaterThan(0);
    expect(COMMON_CONDITIONS.length).toBeGreaterThan(0);
  });

  it("GOALS items have id + label", () => {
    for (const g of GOALS) {
      expect(g.id).toBeTruthy();
      expect(g.label).toBeTruthy();
    }
    const ids = GOALS.map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});