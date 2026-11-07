import { discoverEditionSchema } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it } from "vitest";

import { buildHouseEdition } from "../house-edition";

const now = new Date("2026-10-29T08:00:00.000Z");

describe("buildHouseEdition", () => {
  it("is a valid edition whose starter tiles all have house covers", () => {
    const edition = buildHouseEdition({ date: "2026-10-29", now });

    expect(discoverEditionSchema.safeParse(edition).success).toBe(true);
    expect(edition.id).toBe("house-2026-10-29");
    expect(
      edition.cards
        .filter((card) => card.kind === "topic")
        .every((card) => card.coverId?.startsWith("house-")),
    ).toBe(true);
  });
});
