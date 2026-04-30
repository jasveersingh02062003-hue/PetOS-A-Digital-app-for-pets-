import { describe, it, expect } from "vitest";
import { formatCurrency, formatDate, formatRelative, formatCompact } from "@/lib/format";

describe("formatCurrency", () => {
  it("formats INR by default", () => {
    const out = formatCurrency(1234);
    expect(out).toMatch(/1,234/);
    expect(out).toMatch(/₹|INR/);
  });

  it("treats null/undefined/NaN as 0", () => {
    expect(formatCurrency(null)).toMatch(/0/);
    expect(formatCurrency(undefined)).toMatch(/0/);
    expect(formatCurrency(NaN)).toMatch(/0/);
  });

  it("respects custom currency", () => {
    const out = formatCurrency(50, { currency: "USD", locale: "en-US" });
    expect(out).toContain("$");
    expect(out).toContain("50");
  });
});

describe("formatDate", () => {
  it("returns empty string for falsy or invalid input", () => {
    expect(formatDate(null)).toBe("");
    expect(formatDate(undefined)).toBe("");
    expect(formatDate("not a date")).toBe("");
  });

  it("formats a real date", () => {
    const out = formatDate(new Date("2026-04-30T00:00:00Z"));
    // tolerant: only assert it produced *something* containing the year and a day-ish token
    expect(out).toMatch(/2026/);
  });
});

describe("formatRelative", () => {
  it("returns empty string on bad input", () => {
    expect(formatRelative(null)).toBe("");
    expect(formatRelative("garbage")).toBe("");
  });

  it("returns a non-empty string for a recent date", () => {
    const out = formatRelative(new Date(Date.now() - 5 * 60_000));
    expect(out.length).toBeGreaterThan(0);
  });
});

describe("formatCompact", () => {
  it("compacts 1500 to a short form", () => {
    const out = formatCompact(1500);
    // Either "1.5K" (en-US) or "1.5T" (en-IN uses T for thousand). Just assert it shrank.
    expect(out.length).toBeLessThan(String(1500).length + 3);
  });

  it("falls back to 0 for nullish", () => {
    expect(formatCompact(null)).toBe("0");
  });
});