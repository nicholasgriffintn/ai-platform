import { describe, expect, it } from "vitest";

import { discoverRailTop } from "./DiscoverFeed";
import { countDiscoverColumns, distributeDiscoverCards } from "./DiscoverMasonry";
import { discoverShelfLayout } from "./DiscoverSection";

describe("discoverShelfLayout", () => {
  it("stretches a few tiles across the whole row instead of leaving a gap", () => {
    const { width } = discoverShelfLayout(1200, 3);

    expect(width * 3 + 12 * 2).toBeCloseTo(1200);
  });

  it("caps the height, so wide tiles do not take over the page", () => {
    expect(discoverShelfLayout(1800, 2).height).toBe(384);
  });

  it("shows only whole tiles and leaves the rest to scroll", () => {
    const { width } = discoverShelfLayout(900, 7);

    expect(width).toBeGreaterThanOrEqual(208);
    expect((900 - width) % (width + 12)).toBeCloseTo(0);
  });

  it("keeps two tiles side by side on a phone", () => {
    expect(discoverShelfLayout(335, 4).width).toBeCloseTo((335 - 12) / 2);
  });
});

describe("discoverRailTop", () => {
  it("offsets a tall rail by its own height, so it sticks at its last card", () => {
    expect(discoverRailTop(1800)).toBe("min(1rem, calc(100dvh - 13rem - 1800px))");
  });
});

describe("countDiscoverColumns", () => {
  it("adds columns as the room grows and stops at the limit", () => {
    expect(countDiscoverColumns(300)).toBe(1);
    expect(countDiscoverColumns(900)).toBe(3);
    expect(countDiscoverColumns(4000)).toBe(5);
  });
});

describe("distributeDiscoverCards", () => {
  const read = (id: string, imageUrl?: string) => ({
    id,
    kind: "read" as const,
    topic: "AI",
    title: id,
    url: "https://example.com/story",
    source: "Example",
    summary: "Summary",
    reason: "Why",
    sensitive: false,
    ...(imageUrl ? { imageUrl } : {}),
  });
  const ids = (columns: ReadonlyArray<ReadonlyArray<{ id: string }>>) =>
    columns.map((column) => column.map((card) => card.id));

  it("sends the next card to the shortest column", () => {
    const cards = [read("tall", "https://example.com/a.jpg"), read("b"), read("c"), read("d")];

    expect(ids(distributeDiscoverCards(cards, 2, 300))).toEqual([["tall"], ["b", "c", "d"]]);
  });

  it("never moves cards already placed when more stories load", () => {
    const first = [read("a", "https://example.com/a.jpg"), read("b"), read("c")];
    const before = ids(distributeDiscoverCards(first, 2, 300));
    const after = ids(distributeDiscoverCards([...first, read("d"), read("e")], 2, 300));

    before.forEach((column, index) => {
      expect(after[index]?.slice(0, column.length)).toEqual(column);
    });
  });
});
