import { describe, it, expect, vi, beforeEach } from "vitest";

// Capture the chained query mock so each test can shape the response.
const lastInsert = vi.fn();
const maybeSingleMock = vi.fn();

vi.mock("@/integrations/supabase/client", () => {
  return {
    supabase: {
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: () => maybeSingleMock(),
              }),
            }),
          }),
        }),
        insert: (row: unknown) => {
          lastInsert(row);
          return Promise.resolve({ error: null });
        },
      }),
    },
  };
});

import { addReaction } from "@/lib/reactions";

describe("addReaction", () => {
  beforeEach(() => {
    lastInsert.mockReset();
    maybeSingleMock.mockReset();
  });

  it("returns false and does not insert when reaction already exists", async () => {
    maybeSingleMock.mockResolvedValueOnce({ data: { kind: "love" }, error: null });
    const out = await addReaction("p1", "u1", "love");
    expect(out).toBe(false);
    expect(lastInsert).not.toHaveBeenCalled();
  });

  it("inserts and returns true when no existing reaction", async () => {
    maybeSingleMock.mockResolvedValueOnce({ data: null, error: null });
    const out = await addReaction("p1", "u1", "paw");
    expect(out).toBe(true);
    expect(lastInsert).toHaveBeenCalledWith({ post_id: "p1", user_id: "u1", kind: "paw" });
  });

  it("defaults to boop (pet-native reaction) when kind is omitted", async () => {
    maybeSingleMock.mockResolvedValueOnce({ data: null, error: null });
    const out = await addReaction("p1", "u1");
    expect(out).toBe(true);
    expect(lastInsert).toHaveBeenCalledWith({ post_id: "p1", user_id: "u1", kind: "boop" });
  });
});