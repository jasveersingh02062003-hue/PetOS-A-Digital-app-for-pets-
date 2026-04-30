import { describe, it, expect } from "vitest";
import { shouldPersistQuery, STALE, PERSIST_BUSTER } from "@/lib/queryClient";

function fakeQuery(status: "success" | "error" | "pending", queryKey: unknown[]) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { state: { status }, queryKey } as any;
}

describe("shouldPersistQuery", () => {
  it("persists successful, non-volatile queries", () => {
    expect(shouldPersistQuery(fakeQuery("success", ["pets", "list"]))).toBe(true);
    expect(shouldPersistQuery(fakeQuery("success", ["profile", "abc"]))).toBe(true);
  });

  it("never persists failed or pending queries", () => {
    expect(shouldPersistQuery(fakeQuery("error", ["pets"]))).toBe(false);
    expect(shouldPersistQuery(fakeQuery("pending", ["pets"]))).toBe(false);
  });

  it("skips realtime/ephemeral/presence/typing/upload/stream prefixes", () => {
    for (const prefix of ["realtime", "ephemeral", "presence", "typing", "upload", "stream"]) {
      expect(shouldPersistQuery(fakeQuery("success", [prefix]))).toBe(false);
      expect(shouldPersistQuery(fakeQuery("success", [`${prefix}:foo`]))).toBe(false);
      expect(shouldPersistQuery(fakeQuery("success", [`${prefix}/bar`]))).toBe(false);
    }
  });

  it("does not match prefixes inside other words", () => {
    // 'realtimeish' must NOT be excluded just because it starts with 'realtime'
    // (we only match exact / : / / boundaries).
    expect(shouldPersistQuery(fakeQuery("success", ["realtimeish"]))).toBe(true);
  });
});

describe("STALE presets", () => {
  it("are ordered from shortest to longest", () => {
    expect(STALE.realtime).toBeLessThan(STALE.short);
    expect(STALE.short).toBeLessThan(STALE.default);
    expect(STALE.default).toBeLessThan(STALE.medium);
    expect(STALE.medium).toBeLessThan(STALE.long);
    expect(STALE.long).toBeLessThan(STALE.immutable);
  });
});

describe("PERSIST_BUSTER", () => {
  it("includes the schema rev", () => {
    expect(PERSIST_BUSTER.startsWith("v1:")).toBe(true);
  });
});