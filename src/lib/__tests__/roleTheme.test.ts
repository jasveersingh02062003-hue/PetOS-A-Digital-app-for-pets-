import { describe, it, expect } from "vitest";
import {
  getRoleRing, getRoleBanner, getRoleSubmit, getRoleComposerCopy, isOrgRole, ORG_ROLES,
} from "@/lib/roleTheme";

describe("roleTheme", () => {
  it("returns the pet_parent default for unknown / null roles", () => {
    expect(getRoleRing(null)).toBe(getRoleRing("pet_parent"));
    expect(getRoleRing(undefined)).toBe(getRoleRing("pet_parent"));
    expect(getRoleRing("nonsense")).toBe(getRoleRing("pet_parent"));
    expect(getRoleBanner("nonsense")).toBe(getRoleBanner("pet_parent"));
    expect(getRoleSubmit("nonsense")).toBe(getRoleSubmit("pet_parent"));
    expect(getRoleComposerCopy("nonsense")).toEqual(getRoleComposerCopy("pet_parent"));
  });

  it("returns role-specific values for known roles", () => {
    expect(getRoleRing("breeder")).toContain("amber");
    expect(getRoleRing("rescuer")).toContain("coral");
    expect(getRoleSubmit("breeder")).toContain("amber");
    expect(getRoleComposerCopy("shelter").placeholder).toMatch(/shelter|adoption/i);
  });

  it("isOrgRole flags only org-style roles", () => {
    for (const r of ORG_ROLES) expect(isOrgRole(r)).toBe(true);
    expect(isOrgRole("pet_parent")).toBe(false);
    expect(isOrgRole("buyer")).toBe(false);
    expect(isOrgRole(null)).toBe(false);
    expect(isOrgRole("garbage")).toBe(false);
  });
});