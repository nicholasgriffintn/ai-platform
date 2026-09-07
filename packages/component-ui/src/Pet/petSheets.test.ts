import { describe, expect, it } from "vitest";

import { resolvePetSheetUrl } from "./petSheets";

describe("resolvePetSheetUrl", () => {
  it("hands a built-in preset the sheet this build emitted", () => {
    expect(resolvePetSheetUrl("/pets/ash.png")).not.toBe("/pets/ash.png");
  });

  it("passes an account's own sheet through untouched", () => {
    const sheet = "https://polychat.test/user/pets/pet-1/sheet";

    expect(resolvePetSheetUrl(sheet)).toBe(sheet);
  });

  it.each(["constructor", "__proto__", "toString", "valueOf"])(
    "passes %s through rather than answering with an inherited property",
    (sheet) => {
      expect(resolvePetSheetUrl(sheet)).toBe(sheet);
    },
  );
});
