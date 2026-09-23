import { beforeEach, describe, expect, it, vi } from "vitest";

const { tryDecide } = vi.hoisted(() => ({ tryDecide: vi.fn() }));

vi.mock("~/infrastructure/ai", () => ({ ai: { tryDecide } }));

import { gateMemoryClassification } from "~/modules/memory/application/gate";

const env = {} as never;

describe("gateMemoryClassification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("proceeds when no decision model is available", async () => {
    tryDecide.mockResolvedValue(null);

    await expect(
      gateMemoryClassification({ env, message: "what's the weather?" }),
    ).resolves.toEqual({ proceed: true, probability: null });
  });

  it("skips classification when the message is confidently not memorable", async () => {
    tryDecide.mockResolvedValue({ answers: { worth_remembering: { type: "noul", noul: 0.04 } } });

    await expect(
      gateMemoryClassification({ env, message: "what's the weather?" }),
    ).resolves.toEqual({ proceed: false, probability: 0.04 });
    expect(tryDecide.mock.calls[0]?.[0]).toMatchObject({
      state: { message: "what's the weather?" },
    });
  });

  it("proceeds at or above the threshold and fails open on errors", async () => {
    tryDecide.mockResolvedValue({ answers: { worth_remembering: { type: "noul", noul: 0.25 } } });

    await expect(gateMemoryClassification({ env, message: "I live in Leeds" })).resolves.toEqual({
      proceed: true,
      probability: 0.25,
    });

    tryDecide.mockRejectedValue(new Error("boom"));

    await expect(gateMemoryClassification({ env, message: "I live in Leeds" })).resolves.toEqual({
      proceed: true,
      probability: null,
    });
  });
});
