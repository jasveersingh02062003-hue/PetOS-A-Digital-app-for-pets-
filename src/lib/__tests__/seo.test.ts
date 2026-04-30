import { describe, it, expect, beforeEach } from "vitest";
import { applySeo } from "@/lib/seo";

describe("applySeo", () => {
  beforeEach(() => {
    document.head.innerHTML = "";
    document.title = "";
  });

  it("sets a default title when none provided", () => {
    applySeo();
    expect(document.title).toContain("Petos");
    const desc = document.head.querySelector('meta[name="description"]');
    expect(desc?.getAttribute("content")).toBeTruthy();
  });

  it("appends the site name to a custom title", () => {
    applySeo({ title: "Buddy the Dog" });
    expect(document.title).toMatch(/Buddy the Dog/);
    expect(document.title).toMatch(/Petos/);
  });

  it("writes Open Graph and Twitter cards", () => {
    applySeo({ title: "Hello", description: "world", image: "/x.png" });
    expect(
      document.head.querySelector('meta[property="og:title"]')?.getAttribute("content"),
    ).toMatch(/Hello/);
    expect(
      document.head.querySelector('meta[name="twitter:card"]')?.getAttribute("content"),
    ).toBe("summary_large_image");
    expect(
      document.head.querySelector('meta[property="og:image"]')?.getAttribute("content"),
    ).toBe("/x.png");
  });

  it("noIndex flips robots meta to noindex,nofollow", () => {
    applySeo({ noIndex: true });
    expect(
      document.head.querySelector('meta[name="robots"]')?.getAttribute("content"),
    ).toBe("noindex,nofollow");
  });

  it("is idempotent — calling twice does not duplicate tags", () => {
    applySeo({ title: "A" });
    applySeo({ title: "B" });
    const titles = document.head.querySelectorAll('meta[property="og:title"]');
    expect(titles.length).toBe(1);
    expect(titles[0].getAttribute("content")).toMatch(/B/);
  });
});