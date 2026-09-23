import { describe, expect, it } from "vitest";

import { createSiteGenerationTrace } from "~/modules/sites/application/generation-pass";

describe("createSiteGenerationTrace", () => {
  it("explains when a model response contains no valid site updates", () => {
    const trace = createSiteGenerationTrace({
      id: "site-1:build",
      stage: "build",
      outcome: "discarded",
      result: { patches: [], applied: 0, rejected: 1, skippedLines: 2, durationMs: 50 },
      provider: "test",
      model: "test-model",
    });

    expect(trace).toMatchObject({
      outcome: "discarded",
      summary: "No site updates were applied because the response contained no valid patches",
      patchCount: 0,
      rejectedPatchCount: 1,
      skippedLineCount: 2,
    });
  });
});
