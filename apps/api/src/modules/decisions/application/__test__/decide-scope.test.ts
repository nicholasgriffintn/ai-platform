import type { DecisionRequest } from "@ngriffin_uk/polychat-schemas";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { IEnv, IUser } from "~/types";

const mocks = vi.hoisted(() => ({
  decide: vi.fn(),
  resolveDecisionTarget: vi.fn(),
}));

vi.mock("~/infrastructure/ai", () => ({
  ai: { decide: mocks.decide, resolveDecisionTarget: mocks.resolveDecisionTarget },
}));

import { decide } from "../decide";

const request: DecisionRequest = {
  state: "A charades clip",
  questions: { talking: { type: "noul", instructions: "Does the performer speak?" } },
};

function run(overrides: Partial<DecisionRequest>, credentialScope?: "full" | "pashi") {
  return decide({
    env: {} as IEnv,
    user: { id: 1 } as IUser,
    request: { ...request, ...overrides },
    credentialScope,
  });
}

describe("decisions with a Pashi-scoped key", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveDecisionTarget.mockResolvedValue({ model: "clef", provider: "workers-ai" });
    mocks.decide.mockResolvedValue({ answers: {} });
  });

  it("refuses to choose a model or provider", async () => {
    await expect(run({ model: "expensive-model" }, "pashi")).rejects.toMatchObject({
      statusCode: 403,
    });
    await expect(run({ provider: "openai" }, "pashi")).rejects.toMatchObject({ statusCode: 403 });
    expect(mocks.decide).not.toHaveBeenCalled();
  });

  it("runs on the default decision model", async () => {
    await run({}, "pashi");

    expect(mocks.resolveDecisionTarget).toHaveBeenCalledWith(
      expect.objectContaining({ model: undefined, provider: undefined }),
    );
    expect(mocks.decide).toHaveBeenCalledOnce();
  });

  it("still lets a full key choose a model", async () => {
    await run({ model: "expensive-model" }, "full");

    expect(mocks.resolveDecisionTarget).toHaveBeenCalledWith(
      expect.objectContaining({ model: "expensive-model" }),
    );
  });
});
