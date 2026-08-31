import type { ModelConfig, ModelConfigItem } from "@ngriffin_uk/polychat-schemas";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { IEnv, IUser } from "~/types";
import { ErrorType } from "~/utils/errors";

const mocks = vi.hoisted(() => ({
  filterModelsForUserAccess: vi.fn(),
  getModels: vi.fn(),
  selectModel: vi.fn(),
  selectMultipleModels: vi.fn(),
}));

vi.mock("~/lib/modelRouter", () => ({
  ModelRouter: {
    selectModel: mocks.selectModel,
    selectMultipleModels: mocks.selectMultipleModels,
  },
}));

vi.mock("~/lib/providers/models", () => ({
  filterModelsForUserAccess: mocks.filterModelsForUserAccess,
  getModels: mocks.getModels,
}));

import { resolveExecutableModelForRequest, selectModels } from "../model-access";

const env: IEnv = Object.create(null);
const user = {
  id: 42,
  name: null,
  avatar_url: null,
  email: "free@example.com",
  github_username: null,
  company: null,
  site: null,
  location: null,
  bio: null,
  twitter_username: null,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  setup_at: null,
  terms_accepted_at: null,
  plan_id: "free",
} satisfies IUser;

function model(id: string, overrides: Partial<ModelConfigItem> = {}): ModelConfigItem {
  return {
    matchingModel: id,
    provider: "test-provider",
    modalities: { input: ["text"], output: ["text"] },
    contextComplexity: 3,
    reliability: 3,
    speed: 4,
    ...overrides,
  };
}

describe("explicit model access", () => {
  const allowedModel = model("allowed", { isFree: true });
  const paidModel = model("paid");
  const allModels: ModelConfig = { allowed: allowedModel, paid: paidModel };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getModels.mockReturnValue(allModels);
    mocks.filterModelsForUserAccess.mockResolvedValue({ allowed: allowedModel });
  });

  it("rejects an inaccessible singular model request", async () => {
    await expect(
      selectModels(env, "hello", [], undefined, user, "completion-1", "paid"),
    ).rejects.toMatchObject({
      type: ErrorType.AUTHORISATION_ERROR,
      statusCode: 403,
    });

    expect(mocks.selectModel).not.toHaveBeenCalled();
  });

  it("rejects a plural request if any requested model is inaccessible", async () => {
    await expect(
      selectModels(env, "hello", [], undefined, user, "completion-1", undefined, true, [
        "allowed",
        "paid",
      ]),
    ).rejects.toMatchObject({
      type: ErrorType.AUTHORISATION_ERROR,
      statusCode: 403,
    });

    expect(mocks.selectMultipleModels).not.toHaveBeenCalled();
  });

  it("preserves an accessible explicit selection without invoking the router", async () => {
    await expect(
      selectModels(env, "hello", [], undefined, user, "completion-1", "allowed"),
    ).resolves.toEqual(["allowed"]);

    expect(mocks.selectModel).not.toHaveBeenCalled();
  });

  it("requires the accessible model and requested provider to match atomically", async () => {
    const sharedModel = model("upstream-shared", {
      isFree: true,
      provider: "provider-a",
    });

    mocks.getModels.mockReturnValue({ shared: sharedModel });
    mocks.filterModelsForUserAccess.mockResolvedValue({ shared: sharedModel });

    await expect(
      selectModels(
        env,
        "hello",
        [],
        undefined,
        user,
        "completion-1",
        "shared",
        false,
        undefined,
        "provider-b",
      ),
    ).rejects.toMatchObject({
      type: ErrorType.AUTHORISATION_ERROR,
      statusCode: 403,
    });
  });

  it("rejects deprecated models even when the provider exposes them", async () => {
    const deprecatedModel = model("retired", {
      deprecated: true,
      isFree: true,
    });

    mocks.getModels.mockReturnValue({ retired: deprecatedModel });
    mocks.filterModelsForUserAccess.mockResolvedValue({ retired: deprecatedModel });

    await expect(resolveExecutableModelForRequest({ env, model: "retired" })).rejects.toMatchObject(
      {
        type: ErrorType.AUTHENTICATION_ERROR,
        statusCode: 403,
      },
    );
  });

  it("allows a Free account to execute a BYOK model", async () => {
    const byokModel = model("byok", { isByokEnabled: true });

    mocks.getModels.mockReturnValue({ byok: byokModel });
    mocks.filterModelsForUserAccess.mockResolvedValue({ byok: byokModel });

    await expect(resolveExecutableModelForRequest({ env, user, model: "byok" })).resolves.toEqual({
      id: "byok",
      config: byokModel,
      credentialAuthority: "byok",
    });
  });

  it("allows a Pro account to execute an active paid model", async () => {
    const proUser = { ...user, plan_id: "pro" } satisfies IUser;

    mocks.getModels.mockReturnValue({ paid: paidModel });
    mocks.filterModelsForUserAccess.mockResolvedValue({ paid: paidModel });

    await expect(
      resolveExecutableModelForRequest({ env, user: proUser, model: "paid" }),
    ).resolves.toEqual({
      id: "paid",
      config: paidModel,
      credentialAuthority: "platform",
    });
  });
});
