import type { ModelConfig, ModelConfigItem } from "@ngriffin_uk/polychat-schemas";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { IEnv, IUser } from "~/types";
import { ErrorType } from "~/utils/errors";

const mocks = vi.hoisted(() => ({
  filterModelsForUserAccess: vi.fn(),
  getLineupModelsForUser: vi.fn(),
  getModels: vi.fn(),
}));

vi.mock("~/lib/providers/models", () => ({
  filterModelsForUserAccess: mocks.filterModelsForUserAccess,
  getLineupModelsForUser: mocks.getLineupModelsForUser,
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
const proUser = { ...user, plan_id: "pro" } satisfies IUser;

function model(id: string, overrides: Partial<ModelConfigItem> = {}): ModelConfigItem {
  return {
    matchingModel: id,
    provider: "test-provider",
    modalities: { input: ["text"], output: ["text"] },
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
      selectModels({ env, user, attachments: [], tier: "medium", requestedModel: "paid" }),
    ).rejects.toMatchObject({
      type: ErrorType.AUTHORISATION_ERROR,
      statusCode: 403,
    });

    expect(mocks.getLineupModelsForUser).not.toHaveBeenCalled();
  });

  it("rejects a plural request if any requested model is inaccessible", async () => {
    await expect(
      selectModels({
        env,
        user,
        attachments: [],
        tier: "medium",
        useMultiModel: true,
        requestedModels: ["allowed", "paid"],
      }),
    ).rejects.toMatchObject({
      type: ErrorType.AUTHORISATION_ERROR,
      statusCode: 403,
    });
  });

  it("preserves an accessible explicit selection without consulting the lineup", async () => {
    await expect(
      selectModels({ env, user, attachments: [], tier: "ultra", requestedModel: "allowed" }),
    ).resolves.toEqual({ models: ["allowed"] });

    expect(mocks.getLineupModelsForUser).not.toHaveBeenCalled();
  });

  it("requires the accessible model and requested provider to match atomically", async () => {
    const sharedModel = model("upstream-shared", {
      isFree: true,
      provider: "provider-a",
    });

    mocks.getModels.mockReturnValue({ shared: sharedModel });
    mocks.filterModelsForUserAccess.mockResolvedValue({ shared: sharedModel });

    await expect(
      selectModels({
        env,
        user,
        attachments: [],
        tier: "medium",
        requestedModel: "shared",
        requestedProvider: "provider-b",
      }),
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

describe("tier model selection", () => {
  const fable = model("claude-fable-5-1", {
    provider: "anthropic",
    family: "claude-fable",
    modalities: { input: ["text", "image", "pdf"], output: ["text"] },
    reasoningConfig: { supportedEffortLevels: ["low", "medium", "high", "xhigh", "max"] },
  });
  const astra = model("gpt-6-astra", {
    provider: "openai",
    family: "gpt-astra",
    modalities: { input: ["text", "image", "pdf"], output: ["text"] },
    reasoningConfig: { supportedEffortLevels: ["low", "medium", "high", "xhigh", "max"] },
  });
  const geminiFlash = model("gemini-3.5-flash", {
    provider: "google-ai-studio",
    isFree: true,
    modalities: { input: ["text", "image", "video", "audio", "pdf"], output: ["text"] },
    reasoningConfig: { supportedEffortLevels: ["minimal", "low", "medium", "high"] },
  });
  const deepseekFlash = model("deepseek-v4-flash", {
    provider: "deepseek",
    isFree: true,
    reasoningConfig: { supportedEffortLevels: ["low", "high", "max"] },
  });
  const geminiLite = model("gemini-3.1-flash-lite", {
    provider: "google-ai-studio",
    isFree: true,
    modalities: { input: ["text", "image", "pdf"], output: ["text"] },
    reasoningConfig: { supportedEffortLevels: ["minimal", "low", "medium", "high"] },
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getLineupModelsForUser.mockResolvedValue({
      "claude-fable-5-1": fable,
      "gpt-6-astra": astra,
      "google-ai-studio/gemini-3.5-flash": geminiFlash,
      "deepseek-v4-flash": deepseekFlash,
      "google-ai-studio/gemini-3.1-flash-lite": geminiLite,
    });
  });

  it("walks the tier hierarchy down to what a Free account can execute", async () => {
    await expect(selectModels({ env, user, attachments: [], tier: "ultra" })).resolves.toEqual({
      models: ["google-ai-studio/gemini-3.5-flash"],
      reasoningEffort: "high",
    });
  });

  it("gives a Pro account the top of the hierarchy with the tier effort", async () => {
    await expect(
      selectModels({ env, user: proUser, attachments: [], tier: "ultra" }),
    ).resolves.toEqual({
      models: ["gpt-6-astra"],
      reasoningEffort: "max",
    });
  });

  it("skips candidates that cannot take the attached input", async () => {
    await expect(
      selectModels({
        env,
        user,
        attachments: [{ type: "image", url: "https://example.com/cat.png" }],
        tier: "low",
      }),
    ).resolves.toEqual({
      models: ["google-ai-studio/gemini-3.1-flash-lite"],
      reasoningEffort: "low",
    });
  });

  it("pairs a comparison alternate from another provider and family", async () => {
    await expect(
      selectModels({ env, user: proUser, attachments: [], tier: "ultra", useMultiModel: true }),
    ).resolves.toEqual({
      models: ["gpt-6-astra", "claude-fable-5-1"],
      reasoningEffort: "max",
    });
  });

  it("fails closed when no candidate in the tier is executable", async () => {
    mocks.getLineupModelsForUser.mockResolvedValue({});

    await expect(
      selectModels({ env, user, attachments: [], tier: "medium" }),
    ).rejects.toMatchObject({ type: ErrorType.PARAMS_ERROR });
  });
});
