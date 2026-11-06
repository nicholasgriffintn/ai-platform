import type { ModelConfigItem } from "@ngriffin_uk/polychat-schemas";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { IEnv, IUser } from "~/types";

const mocks = vi.hoisted(() => ({
  getLineupModelsForUser: vi.fn(),
  resolveTierModel: vi.fn(),
}));

vi.mock("@ngriffin_uk/polychat-ai-models", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@ngriffin_uk/polychat-ai-models")>()),
  resolveTierModel: mocks.resolveTierModel,
}));
vi.mock("~/modules/models/application/resolve", () => ({
  getLineupModelsForUser: mocks.getLineupModelsForUser,
}));

import { resolveReviewers } from "../second_opinion";

const env = {} as IEnv;
const user = { id: 1 } as IUser;
const usable = { matchingModel: "gpt-oss-120b", provider: "workers-ai", name: "GPT OSS" };

describe("resolveReviewers", () => {
  beforeEach(() => {
    mocks.resolveTierModel.mockReset();
    mocks.getLineupModelsForUser.mockResolvedValue({
      "gpt-oss": usable as ModelConfigItem,
    });
  });

  it("uses a requested model the person can run", async () => {
    const reviewers = await resolveReviewers(["gpt-oss-120b"], env, user, "other");

    expect(reviewers.map((reviewer) => reviewer.provider)).toEqual(["workers-ai"]);
    expect(mocks.resolveTierModel).not.toHaveBeenCalled();
  });

  it("never reaches for a model outside the person's lineup", async () => {
    mocks.resolveTierModel.mockReturnValue({ config: usable });

    const reviewers = await resolveReviewers(["gpt-5-copilot-only"], env, user, "other");

    expect(reviewers.map((reviewer) => reviewer.model)).toEqual(["gpt-oss-120b"]);
  });

  it("leaves the answering model out of the fallback", async () => {
    mocks.resolveTierModel.mockReturnValue(null);

    await expect(resolveReviewers(["unknown"], env, user, "gpt-oss-120b")).resolves.toEqual([]);

    const options = mocks.resolveTierModel.mock.calls[0]?.[4];

    expect(options?.isEligible(usable)).toBe(false);
  });
});
