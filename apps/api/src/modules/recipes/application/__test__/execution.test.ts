import type { RecipeInvocationResponse } from "@ngriffin_uk/polychat-schemas";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { IEnv, IUser } from "~/types";

const mocks = vi.hoisted(() => ({
  startResponse: vi.fn(),
  generateId: vi.fn(),
}));

vi.mock("~/modules/responses/application/start", () => ({
  startResponse: mocks.startResponse,
}));

vi.mock("../recipe-model", () => ({
  resolveRecipeModel: vi.fn().mockResolvedValue({
    id: "glm-5.3-flash",
    name: "GLM 5.3 Flash",
    model: "@cf/zai-org/glm-5.3-flash",
    provider: "workers-ai",
  }),
}));

vi.mock("@ngriffin_uk/polychat-utility-core", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@ngriffin_uk/polychat-utility-core")>()),
  generateId: mocks.generateId,
}));

import { fakeRepositories } from "~/infrastructure/database/__test__/fake-repositories";
import { ConversationRepository } from "~/modules/conversations/infrastructure/ConversationRepository";
import { TemplateRepository } from "~/modules/templates/infrastructure/TemplateRepository";
import { UsageEventRepository } from "~/modules/usage/infrastructure/UsageEventRepository";

import { executeRecipeInvocationChat } from "../execution";
import { createRecipeMessageUrl } from "../runtime";

describe("recipe message URL", () => {
  it("uses a compact recipe action instead of serialising the generated prompt", () => {
    expect(createRecipeMessageUrl("customer-revenue-operations", "setup")).toBe(
      "/?action=setup&recipe=customer-revenue-operations",
    );
  });
});

describe("executeRecipeInvocationChat", () => {
  const env = { DB: {}, AI: {} } as unknown as IEnv;
  const user = {
    id: 42,
    email: "test@example.com",
    plan_id: "pro",
  } as IUser;
  const updateConversation = vi.fn();
  const getTemplateById = vi.fn();
  const updateTemplate = vi.fn();
  const summariseRunSpend = vi.fn();
  const context = {
    env,
    user,
    repositories: fakeRepositories([
      [
        ConversationRepository,
        {
          updateConversation,
        },
      ],
      [TemplateRepository, { getTemplateById, updateTemplate }],
      [UsageEventRepository, { summariseRunSpend }],
    ]),
  } as any;
  const invocation: RecipeInvocationResponse = {
    recipeId: "notes-assistant",
    recipeTitle: "Notes Assistant",
    installationId: "installation-1",
    channel: "scheduled",
    status: "ready",
    conversationStarter: "Run this installed Notion recipe.",
    messageUrl: "/?query=Run",
    missingConnections: [],
    enabledTools: ["use_recipe_connector"],
    allowedConnectorProviders: ["notion"],
    allowedConnectorOperations: {
      notion: ["NOTION_SEARCH_NOTION_PAGE", "NOTION_ADD_MULTIPLE_PAGE_CONTENT"],
    },
    configuration: { target: "Action log" },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    updateConversation.mockResolvedValue({});
    getTemplateById.mockResolvedValue(null);
    updateTemplate.mockResolvedValue({});
    summariseRunSpend.mockResolvedValue({ credit_micros: 0, cost_micros: 0, run_count: 0 });
    mocks.generateId.mockReturnValue("generated-id");
    mocks.startResponse.mockResolvedValue({
      id: "recipe_generated-id",
      log_id: "log-1",
      object: "chat.completion",
      created: 1,
      choices: [],
    });
  });

  it("titles generated recipe conversations so scheduled runs are visible in history", async () => {
    const result = await executeRecipeInvocationChat({
      env,
      context,
      user,
      invocation,
    });

    expect(result.conversationId).toBe("recipe_generated-id");
    expect(updateConversation).toHaveBeenCalledWith("recipe_generated-id", {
      title: "Recipe: Notes Assistant",
    });
  });

  it("can run a recipe inside an existing SMS conversation window", async () => {
    const result = await executeRecipeInvocationChat({
      env,
      context,
      user,
      invocation,
      conversationId: "sms_conversation",
      priorMessages: [
        {
          id: "message-1",
          role: "user",
          content: "run my action log recipe",
        },
      ],
      channel: {
        id: "sms",
        from: "+15551234567",
        to: "+15557654321",
      },
    });

    expect(result.conversationId).toBe("sms_conversation");
    expect(mocks.generateId).not.toHaveBeenCalled();
    expect(mocks.startResponse).toHaveBeenCalledWith({
      env,
      context,
      user,
      authority: { trigger: "schedule" },
      command: expect.objectContaining({
        conversationId: "sms_conversation",
        messages: [
          {
            id: "message-1",
            role: "user",
            content: "run my action log recipe",
          },
          {
            role: "user",
            content: "Run this installed Notion recipe.",
          },
        ],
        settings: expect.objectContaining({
          options: expect.objectContaining({
            source: "sms",
            channel: {
              id: "sms",
              from: "+15551234567",
              to: "+15557654321",
            },
          }),
        }),
      }),
    });
  });
});
