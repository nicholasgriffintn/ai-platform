import { describe, expect, it } from "vitest";

import {
  getRealtimeLiveProviderManifestItem,
  REALTIME_LIVE_PROVIDER_MANIFEST,
  realtimeLiveProviderManifestItemSchema,
  realtimeLiveProviderManifestResponseSchema,
} from "./realtime";

describe("legacy realtime provider manifest compatibility", () => {
  it("preserves the original public manifest shape and lookup behaviour", () => {
    expect(
      realtimeLiveProviderManifestResponseSchema.parse({
        providers: REALTIME_LIVE_PROVIDER_MANIFEST,
      }),
    ).toEqual({ providers: REALTIME_LIVE_PROVIDER_MANIFEST });
    expect(
      realtimeLiveProviderManifestItemSchema.safeParse({
        ...REALTIME_LIVE_PROVIDER_MANIFEST[0],
        order: 0,
      }).data,
    ).not.toHaveProperty("order");
    expect(getRealtimeLiveProviderManifestItem("openai").id).toBe("openai");
    expect(() => getRealtimeLiveProviderManifestItem("unknown")).toThrow(
      "Unknown realtime live provider: unknown",
    );
  });
});
