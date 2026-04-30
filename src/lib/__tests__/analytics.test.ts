import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const insertSpy = vi.fn().mockResolvedValue({ data: null, error: null });
const getUserSpy = vi.fn().mockResolvedValue({ data: { user: { id: "u-test" } } });

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({ insert: (rows: unknown) => insertSpy(rows) }),
    auth: { getUser: () => getUserSpy() },
  },
}));

import { track, trackPageView, setAnalyticsConsent } from "@/lib/analytics";

describe("analytics.track", () => {
  beforeEach(() => {
    insertSpy.mockClear();
    sessionStorage.clear();
    // Phase 10 — track() is consent-gated; explicitly grant for these tests.
    localStorage.clear();
    setAnalyticsConsent(true);
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("batches multiple events fired in the same tick into a single insert", async () => {
    void track("page_view", { route: "/feed" });
    void track("post_create", { has_image: true });
    void track("like", { post_id: "p1" });

    // Let the awaits inside track() resolve, then trip the 250ms debounce.
    await Promise.resolve();
    await Promise.resolve();
    vi.advanceTimersByTime(300);
    await Promise.resolve();
    await Promise.resolve();

    expect(insertSpy).toHaveBeenCalledTimes(1);
    const rows = insertSpy.mock.calls[0][0] as any[];
    expect(rows).toHaveLength(3);
    expect(rows[0].event).toBe("page_view");
    expect(rows[0].user_id).toBe("u-test");
    expect(rows[0].session_id).toBeTruthy();
  });

  it("trackPageView fires a 'page_view' event", async () => {
    trackPageView();
    await Promise.resolve();
    await Promise.resolve();
    vi.advanceTimersByTime(300);
    await Promise.resolve();
    await Promise.resolve();
    const rows = insertSpy.mock.calls.at(-1)?.[0] as any[];
    expect(rows.some((r: any) => r.event === "page_view")).toBe(true);
  });
});