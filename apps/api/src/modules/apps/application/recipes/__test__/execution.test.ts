import type { RecipeInvocationResponse } from "@ngriffin_uk/polychat-schemas";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { IEnv, IUser } from "~/types";

const mocks = vi.hoisted(() => ({
  handleCreateChatCompletions: vi.fn(),
  generateId: vi.fn(),
}));

vi.mock("~/modules/completions/application/createChatCompletions", () => ({
  handleCreateChatCompletions: mocks.handleCreateChatCompletions,
}));

vi.mock("@ngriffin_uk/polychat-utility-core", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@ngriffin_uk/polychat-utility-core")>()),
  generateId: mocks.generateId,
}));

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
  const context = {
    env,
    user,
    repositories: {
      conversations: {
        updateConversation,
      },
    },
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
    mocks.generateId.mockReturnValue("generated-id");
    mocks.handleCreateChatCompletions.mockResolvedValue({
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
    expect(mocks.handleCreateChatCompletions).toHaveBeenCalledWith({
      env,
      context,
      user,
      request: expect.objectContaining({
        completion_id: "sms_conversation",
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
        options: expect.objectContaining({
          source: "sms",
          channel: {
            id: "sms",
            from: "+15551234567",
            to: "+15557654321",
          },
        }),
      }),
    });
  });
});
