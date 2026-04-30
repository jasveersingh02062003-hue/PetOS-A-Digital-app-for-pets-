import { describe, it, expect } from "vitest";
import {
  haversineKm, totalDistanceKm, formatDuration, paceMinPerKm, formatPace,
} from "@/lib/walkStats";

describe("haversineKm", () => {
  it("returns 0 for identical points", () => {
    expect(haversineKm([12.97, 77.59], [12.97, 77.59])).toBeCloseTo(0, 5);
  });

  it("approximates Bengaluru → Mumbai (~840 km) within 5%", () => {
    const d = haversineKm([12.97, 77.59], [19.07, 72.87]);
    expect(d).toBeGreaterThan(800);
    expect(d).toBeLessThan(870);
  });
});

describe("totalDistanceKm", () => {
  it("returns 0 for empty / single point", () => {
    expect(totalDistanceKm([])).toBe(0);
    expect(totalDistanceKm([[1, 1]])).toBe(0);
  });

  it("sums multi-segment paths", () => {
    const d = totalDistanceKm([[0, 0], [0, 1], [1, 1]]);
    expect(d).toBeGreaterThan(150);
  });
});

describe("formatDuration", () => {
  it("formats < 1h as m:ss", () => {
    expect(formatDuration(65 * 1000)).toBe("1:05");
  });
  it("formats >= 1h as h:mm:ss", () => {
    expect(formatDuration(3661 * 1000)).toBe("1:01:01");
  });
  it("guards against negative / NaN", () => {
    expect(formatDuration(-1)).toBe("0:00");
    expect(formatDuration(NaN)).toBe("0:00");
  });
});

describe("paceMinPerKm + formatPace", () => {
  it("returns null for tiny / zero distance", () => {
    expect(paceMinPerKm(0.001, 60_000)).toBeNull();
  });

  it("returns null for non-positive duration", () => {
    expect(paceMinPerKm(1, 0)).toBeNull();
  });

  it("computes 6:00/km from 1km in 6min", () => {
    const p = paceMinPerKm(1, 6 * 60_000);
    expect(p).toBeCloseTo(6, 5);
    expect(formatPace(p)).toBe("6:00 /km");
  });

  it("formatPace handles null / absurd values", () => {
    expect(formatPace(null)).toBe("—");
    expect(formatPace(120)).toBe("—");
  });
});