import { describe, expect, it } from "vitest";

import { isActiveDiscoverReader } from "../listen";

const NOW = Date.parse("2026-10-24T07:00:00.000Z");
const opened = (createdAt: string) => ({
  editionId: "edition_1",
  cardId: "card_1",
  signal: "opened" as const,
  topic: null,
  title: "Brazil",
  url: null,
  createdAt,
});

describe("isActiveDiscoverReader", () => {
  it("renders a first edition's listen for everyone", () => {
    expect(isActiveDiscoverReader([], false, NOW)).toBe(true);
  });

  it("only renders ahead for people who used Discover in the last three days", () => {
    expect(isActiveDiscoverReader([opened("2026-10-22T09:00:00Z")], true, NOW)).toBe(true);
    expect(isActiveDiscoverReader([opened("2026-10-19T09:00:00Z")], true, NOW)).toBe(false);
    expect(isActiveDiscoverReader([], true, NOW)).toBe(false);
  });
});
