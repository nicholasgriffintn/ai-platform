import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ runSiteGeneration: vi.fn() }));

vi.mock("~/modules/sites/application/generate", () => ({
  runSiteGeneration: mocks.runSiteGeneration,
}));

import { evaluateSitePrompts, scoreSiteQuality } from "~/modules/sites/application/evaluate";

const quality = (coverage: number) => ({
  coverage,
  placeholders: 0.1,
  coherent: 0.9,
  readable: 0.95,
  repairs: 0,
  needsRepair: false,
  confidence: 0.8,
});

describe("evaluateSitePrompts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.runSiteGeneration.mockImplementation(async ({ overrides, request }) => {
      if (request.prompt === "broken") {
        throw new Error("model down");
      }

      return {
        site: { project: { pages: { home: {} } } },
        plan: { model: "m" },
        issues: overrides.guidance ? [] : [{ severity: "warning", message: "x" }],
        quality: quality(overrides.guidance ? 1 : 0.5),
      };
    });
  });

  it("runs every brief per variant without persisting, scores with Jev and picks the best", async () => {
    const result = await evaluateSitePrompts({
      context: {} as never,
      user: { id: 1 } as never,
      request: { briefs: ["a bakery", "broken"], guidance: [true, false] },
    });

    expect(mocks.runSiteGeneration).toHaveBeenCalledTimes(4);
    expect(mocks.runSiteGeneration.mock.calls.every(([options]) => options.persist === false)).toBe(
      true,
    );
    expect(result.best?.variantId).toBe("guidance=true,subset=true,tier=low");
    expect(result.runs).toHaveLength(4);
    expect(result.runs.filter((run) => !run.ok).map((run) => run.error)).toEqual([
      "model down",
      "model down",
    ]);
    expect(scoreSiteQuality(quality(1), 0)).toBeCloseTo(0.96);
    expect(scoreSiteQuality(null, 0)).toBe(0);
  });
});
