import { describe, expect, it } from "vitest";

import { responseViewNames } from "./customResponseViews.js";
import { responseViewRegistry } from "./responseViewRegistry.js";

describe("customResponseViews", () => {
  it("exposes a lazy entry for every registered response view", () => {
    expect([...responseViewNames].sort()).toEqual(Object.keys(responseViewRegistry).sort());
  });
});
