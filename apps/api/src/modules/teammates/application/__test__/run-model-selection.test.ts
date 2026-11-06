import {
  POLY_TEAMMATE_ID,
  type ResponseSettings,
  type TeammateContext,
} from "@ngriffin_uk/polychat-schemas";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createServiceContext } from "~/infrastructure/context/serviceContext";
import { fakeRepositories } from "~/infrastructure/database/__test__/fake-repositories";
import type { Teammate } from "~/infrastructure/database/schema";
import type { ResponseCommand } from "~/modules/responses/domain/command";
import { TeammateComputerRepository } from "~/modules/teammates/infrastructure/TeammateComputerRepository";
import { TeammateContextRepository } from "~/modules/teammates/infrastructure/TeammateContextRepository";
import type { IEnv, IUser, IUserSettings } from "~/types";

import { enqueueTeammateRun } from "../run-admission";

const mocks = vi.hoisted(() => ({
  startResponse: vi.fn(async (_input: { command: ResponseCommand }) => ({ content: "Done" })),
  prepareTeammateRun: vi.fn(),
  requireSystemModel: vi.fn(async () => ({
    id: "routine-choice",
    name: "Routine choice",
    model: "routine-provider-model",
    provider: "workers-ai",
    effort: "low",
  })),
  selectModels: vi.fn(async () => ({ models: ["tier-choice"], reasoningEffort: "high" })),
  findModelConfig: vi.fn(async (model: string) => ({
    matchingModel: model,
    provider: model === "preferred-model" ? "mistral" : "workers-ai",
    supportsMcp: false,
  })),
  getRequestUserSettings: vi.fn<
    () => Promise<Pick<IUserSettings, "default_model_id" | "default_model_tier">>
  >(async () => ({ default_model_id: "preferred-model", default_model_tier: "high" })),
}));

vi.mock("~/modules/responses/application/start", () => ({ startResponse: mocks.startResponse }));
vi.mock("../execution", () => ({
  prepareTeammateRun: mocks.prepareTeammateRun,
  prepareAdmittedTeammateContinuation: vi.fn(),
}));
vi.mock("../budget", () => ({ assertTeammateContextWithinBudget: vi.fn() }));
vi.mock("~/modules/workspaces/application/chatProjectAccess", () => ({
  resolveChatProjectAccess: async () => null,
}));
vi.mock("~/modules/models/application/resolve", () => ({
  findModelConfig: mocks.findModelConfig,
  requireSystemModel: mocks.requireSystemModel,
}));
vi.mock("~/modules/models/application/access", () => ({ selectModels: mocks.selectModels }));
vi.mock("~/modules/user/application/request-settings", () => ({
  getRequestUserSettings: mocks.getRequestUserSettings,
}));

const env: IEnv = {
  AI: undefined,
  VECTOR_DB: undefined,
  DB: undefined,
  CACHE: undefined,
  ASSETS_BUCKET: undefined,
  PRIVATE_ASSETS_BUCKET: undefined,
  PRIVATE_ASSETS_BUCKET_NAME: "",
  ACCOUNT_ID: "",
  ASSETS_BUCKET_ACCESS_KEY_ID: "",
  ASSETS_BUCKET_SECRET_ACCESS_KEY: "",
};
const user: IUser = {
  id: 7,
  name: null,
  avatar_url: null,
  email: "test@example.com",
  github_username: null,
  company: null,
  site: null,
  location: null,
  bio: null,
  twitter_username: null,
  created_at: "2026-11-01T00:00:00.000Z",
  updated_at: "2026-11-01T00:00:00.000Z",
  setup_at: null,
  terms_accepted_at: null,
  plan_id: "pro",
};
const teammate: Teammate = {
  id: "researcher",
  user_id: 7,
  owner_scope_type: "user",
  owner_scope_id: "7",
  derived_from_teammate_id: null,
  kind: "colleague",
  workspace_default: false,
  name: "Researcher",
  description: "",
  avatar_url: null,
  character_id: null,
  servers: [],
  model: null,
  temperature: null,
  max_steps: null,
  system_prompt: null,
  few_shot_examples: null,
  enabled_tools: [],
  skill_ids: [],
  mode: null,
  created_at: "2026-11-01T00:00:00.000Z",
  updated_at: null,
};
const home: TeammateContext = {
  id: "context-1",
  teammateId: teammate.id,
  actorUserId: user.id,
  scope: { type: "personal", id: "7" },
  homeConversationId: "home-1",
  memoryDocumentId: "memory-1",
  status: "active",
  autonomyLevel: "assistant",
  standingApprovals: [],
  approvalStreaks: [],
  pausedUntil: null,
  ownerSeenAt: null,
  createdAt: "2026-11-01T00:00:00.000Z",
  updatedAt: null,
};

describe("teammate run model selection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getRequestUserSettings.mockResolvedValue({
      default_model_id: "preferred-model",
      default_model_tier: "high",
    });
    mocks.prepareTeammateRun.mockResolvedValue({
      teammate,
      resolution: {
        invocation: { source: "conversation", conversationId: home.homeConversationId },
        actorUserId: user.id,
        teammateId: teammate.id,
        context: home,
        behaviour: "colleague",
        projectId: null,
      },
      connectionGrants: [],
    });
  });

  async function run(settings: ResponseSettings = {}, teammateId = teammate.id) {
    const context = createServiceContext({ env, user });

    vi.spyOn(context, "ensureDatabase").mockReturnValue(env.DB);
    context.repositories = fakeRepositories([
      [TeammateContextRepository, { markOwnerSeen: vi.fn() }],
      [TeammateComputerRepository, { getByContextId: async () => null }],
    ]);

    await enqueueTeammateRun({
      env,
      context,
      user,
      anonymousUser: undefined,
      teammateId,
      body: {
        conversationId: home.homeConversationId,
        messages: [{ role: "user", content: "Hello" }],
        settings,
      },
    });
  }

  it("forwards the configured routines model and effort to the response engine", async () => {
    await run();

    expect(mocks.startResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        command: expect.objectContaining({
          settings: expect.objectContaining({
            model: "routine-choice",
            provider: "workers-ai",
            reasoning_effort: "low",
          }),
        }),
      }),
    );
  });

  it.each([
    {
      defaultModel: "preferred-model",
      expected: { model: "preferred-model", provider: "mistral" },
    },
    {
      defaultModel: null,
      expected: { model: undefined, model_tier: "high" },
    },
  ] satisfies { defaultModel: string | null; expected: Partial<ResponseSettings> }[])(
    "uses the account default for Poly's existing home thread ($defaultModel)",
    async ({ defaultModel, expected }) => {
      mocks.getRequestUserSettings.mockResolvedValue({
        default_model_id: defaultModel,
        default_model_tier: "high",
      });
      mocks.prepareTeammateRun.mockResolvedValue({
        teammate: { ...teammate, id: POLY_TEAMMATE_ID },
        resolution: {
          invocation: { source: "conversation", conversationId: home.homeConversationId },
          actorUserId: user.id,
          teammateId: POLY_TEAMMATE_ID,
          context: { ...home, teammateId: POLY_TEAMMATE_ID },
          behaviour: "colleague",
          projectId: null,
        },
        connectionGrants: [],
      });

      await run({}, POLY_TEAMMATE_ID);

      expect(mocks.requireSystemModel).not.toHaveBeenCalled();
      expect(mocks.startResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          command: expect.objectContaining({
            settings: expect.objectContaining(expected),
          }),
        }),
      );
    },
  );

  it("keeps an explicit model and sampling choice over the defaults", async () => {
    await run({ model: "explicit-model", provider: "workers-ai", reasoning_effort: "high" });

    expect(mocks.requireSystemModel).not.toHaveBeenCalled();
    expect(mocks.startResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        command: expect.objectContaining({
          settings: expect.objectContaining({ model: "explicit-model", reasoning_effort: "high" }),
        }),
      }),
    );
  });

  it("keeps an explicit tier available to the engine instead of fixing the preflight model", async () => {
    await run({ model_tier: "low" });

    expect(mocks.requireSystemModel).not.toHaveBeenCalled();
    expect(mocks.selectModels).toHaveBeenCalledWith(expect.objectContaining({ tier: "low" }));
    expect(mocks.startResponse.mock.calls[0]?.[0].command.settings).toMatchObject({
      model: undefined,
      model_tier: "low",
    });
  });

  it("does not resolve a routines fallback when multiple models are explicitly requested", async () => {
    await run({ models: ["first-model", "second-model"] });

    expect(mocks.requireSystemModel).not.toHaveBeenCalled();
    expect(mocks.startResponse.mock.calls[0]?.[0].command.settings.models).toEqual([
      "first-model",
      "second-model",
    ]);
  });

  it("keeps the selected catalogue ID in the resumable run", async () => {
    await run();

    expect(mocks.startResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        authority: expect.objectContaining({
          teammate: expect.objectContaining({
            configuration: expect.objectContaining({ model: "routine-choice" }),
          }),
        }),
      }),
    );
  });
});
