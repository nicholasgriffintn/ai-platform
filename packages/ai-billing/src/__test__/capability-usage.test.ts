import { describe, expect, it } from "vitest";

import { DEFAULT_CAPABILITY_METERS } from "../usage/capability-usage.js";

describe("reranking capability usage", () => {
  it("meters token-priced reranking responses before provider-specific search units", () => {
    expect(
      DEFAULT_CAPABILITY_METERS.reranking.rerank([], {
        usage: { input_tokens: 120, search_units: 2 },
      }),
    ).toEqual({ unit: "input_tokens", quantity: 120 });
  });
});
