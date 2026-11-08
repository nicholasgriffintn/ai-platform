import { describe, expect, it } from "vitest";

import { assertReleaseAssetUrl } from "../github";

describe("assertReleaseAssetUrl", () => {
  it("refuses an address outside the release hosts", () => {
    expect(() => assertReleaseAssetUrl("https://attacker.example/payload.zip")).toThrow(
      /recognised release location/i,
    );
    expect(() => assertReleaseAssetUrl("http://github.com/payload.zip")).toThrow(
      /recognised release location/i,
    );
  });
});
