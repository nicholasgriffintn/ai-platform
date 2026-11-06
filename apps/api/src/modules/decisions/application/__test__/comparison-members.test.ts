import type { ModelConfigItem } from "@ngriffin_uk/polychat-schemas";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { IEnv, IUser } from "~/types";

import { resolveComparisonMembers } from "../comparison-members";

const mocks = vi.hoisted(() => ({
  lineup: [] as Pick<ModelConfigItem, "matchingModel" | "provider" | "name">[],
}));

vi.mock("@ngriffin_uk/polychat-ai-prompts", () => ({ getPromptText: () => "Answer." }));
vi.mock("~/modules/models/application/resolve", () => ({
  getLineupModelsForUser: vi.fn(async () => ({})),
}));
vi.mock("@ngriffin_uk/polychat-ai-models", () => ({
  resolveTierModel: (
    _models: unknown,
    _user: unknown,
    _tier: unknown,
    _role: unknown,
    options: { isEligible: (model: ModelConfigItem) => boolean },
  ) => {
    const config = mocks.lineup.find((model) => options.isEligible(model as ModelConfigItem));

    return config ? { id: config.matchingModel, config } : null;
  },
}));

const model = (matchingModel: string, provider: string) => ({
  matchingModel,
  provider,
  name: matchingModel,
});

const resolve = (original: { model?: string; provider?: string }) =>
  resolveComparisonMembers({} as IEnv, {} as IUser, original);

describe("resolveComparisonMembers", () => {
  beforeEach(() => {
    mocks.lineup = [];
  });

  it("prefers two vendors other than the one that answered", async () => {
    mocks.lineup = [
      model("a-large", "vendor-a"),
      model("b-small", "vendor-b"),
      model("b-large", "vendor-b"),
      model("c-small", "vendor-c"),
    ];

    const members = await resolve({ model: "a-small", provider: "vendor-a" });

    expect(members.map((member) => member.model)).toEqual(["b-small", "c-small"]);
  });

  it("falls back to another model from the same vendor when the lineup is narrow", async () => {
    mocks.lineup = [model("a-small", "vendor-a"), model("a-large", "vendor-a")];

    const members = await resolve({ model: "a-small", provider: "vendor-a" });

    expect(members.map((member) => member.model)).toEqual(["a-large"]);
  });

  it("never compares a model with itself", async () => {
    mocks.lineup = [model("a-small", "vendor-a")];

    await expect(resolve({ model: "a-small", provider: "vendor-a" })).resolves.toEqual([]);
  });
});
