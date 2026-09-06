import { describe, expect, it } from "vitest";

import { getRegionalModelDisplayName } from "./model-region-variants";
import type { ModelCatalogItem } from "./models";

function model(name: string): ModelCatalogItem {
  return { id: "model-1", name } as unknown as ModelCatalogItem;
}

describe("getRegionalModelDisplayName", () => {
  it("drops a region suffix however much space precedes it", () => {
    expect(getRegionalModelDisplayName(model("Claude Sonnet (US)"))).toBe("Claude Sonnet");
    expect(getRegionalModelDisplayName(model("Claude Sonnet    (Global)"))).toBe("Claude Sonnet");
  });

  it("drops a region vendor prefix", () => {
    expect(getRegionalModelDisplayName(model("EU Anthropic Claude Sonnet"))).toBe("Claude Sonnet");
  });

  it("leaves a name with no region markers alone", () => {
    expect(getRegionalModelDisplayName(model("Claude Sonnet"))).toBe("Claude Sonnet");
  });

  it("keeps a bracketed suffix that is not a region", () => {
    expect(getRegionalModelDisplayName(model("Claude Sonnet (preview)"))).toBe(
      "Claude Sonnet (preview)",
    );
  });

  it("stays linear on a long run of spaces", () => {
    const started = Date.now();

    getRegionalModelDisplayName(model(`Claude${" ".repeat(200_000)}`));

    expect(Date.now() - started).toBeLessThan(1_000);
  });
});
