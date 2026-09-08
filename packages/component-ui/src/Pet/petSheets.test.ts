import { describe, expect, it } from "vitest";

import { resolvePetSheetLayout, resolvePetSheetUrl } from "./petSheets";

describe("resolvePetSheetUrl", () => {
  it.each(["/pets/ash.png", "/pets/wisp.png"])(
    "hands a built-in preset the sheet this build emitted",
    (sheetUrl) => {
      expect(resolvePetSheetUrl(sheetUrl)).not.toBe(sheetUrl);
    },
  );

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

describe("resolvePetSheetLayout", () => {
  it("uses the nine-row Codex layout for Wisp", () => {
    expect(resolvePetSheetLayout("/pets/wisp.png").id).toBe("codex-v1");
  });

  it("uses the Polychat layout for other built-in sheets", () => {
    expect(resolvePetSheetLayout("/pets/pip.png").id).toBe("polychat-v1");
  });
});
