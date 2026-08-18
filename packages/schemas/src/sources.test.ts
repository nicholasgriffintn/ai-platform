import { describe, expect, it } from "vitest";

import { createSourceSchema } from "./sources";

describe("createSourceSchema", () => {
  it("reserves memory sources for the memory provider seam", () => {
    expect(
      createSourceSchema.safeParse({
        kind: "memory",
        title: "A memory-shaped source",
        content: "This must go through MemoryManager.",
        metadata: {},
      }).success,
    ).toBe(false);
  });
});
