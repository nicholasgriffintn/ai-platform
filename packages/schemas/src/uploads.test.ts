import { describe, expect, it } from "vitest";

import { markdownConversionOptionsSchema } from "./uploads";

describe("markdownConversionOptionsSchema", () => {
  it("accepts Cloudflare plain-text output requests", () => {
    expect(
      markdownConversionOptionsSchema.parse({
        output: { format: "text" },
      }),
    ).toEqual({ output: { format: "text" } });
  });
});
