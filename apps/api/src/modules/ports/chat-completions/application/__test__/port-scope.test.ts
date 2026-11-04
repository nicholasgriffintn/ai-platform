import type { ParsedChatCompletionsPortRequest } from "@ngriffin_uk/polychat-schemas";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import type { IUser } from "~/types";

const mocks = vi.hoisted(() => ({
  createModelCompletion: vi.fn(),
  createResponse: vi.fn(),
  selectModels: vi.fn(),
}));

vi.mock("../model-port", () => ({
  completionChunk: vi.fn(),
  createModelCompletion: mocks.createModelCompletion,
}));

vi.mock("~/modules/models/application/access", () => ({
  selectModels: mocks.selectModels,
}));

vi.mock("~/modules/responses/application/create", () => ({
  createResponse: mocks.createResponse,
}));

import { createChatCompletionThroughPort } from "../port";

const messages = [{ role: "user", content: "hello" }];
const user = { id: 1 } as IUser;

function run(request: Record<string, unknown>, conversationHint?: string) {
  return createChatCompletionThroughPort({
    context: { env: {} } as ServiceContext,
    request: { messages, ...request } as ParsedChatCompletionsPortRequest,
    credentialScope: "pashi",
    user,
    conversationHint,
  });
}

describe("chat completions with a Pashi-scoped key", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createModelCompletion.mockResolvedValue(new Response("{}"));
    mocks.selectModels.mockResolvedValue({ models: ["account-default"], reasoningEffort: "low" });
  });

  it("runs the model Polychat picks for the account and tier", async () => {
    await run({ model_tier: "low" });

    expect(mocks.selectModels).toHaveBeenCalledWith(
      expect.objectContaining({ attachments: [], tier: "low", user }),
    );
    expect(mocks.createModelCompletion).toHaveBeenCalledWith(
      expect.objectContaining({
        request: expect.objectContaining({ model: "account-default", reasoning_effort: "low" }),
      }),
    );
    expect(mocks.createResponse).not.toHaveBeenCalled();
  });

  it("falls back to the default tier", async () => {
    await run({});

    expect(mocks.selectModels).toHaveBeenCalledWith(expect.objectContaining({ tier: "medium" }));
  });

  it("ignores a conversation hint from the caller", async () => {
    await run({ model_tier: "low" }, "someone-elses-conversation");

    expect(mocks.createModelCompletion).toHaveBeenCalledWith(
      expect.objectContaining({ conversationId: "chat-completions" }),
    );
  });

  it.each([
    ["a named model", { model: "m" }],
    ["a fallback list", { models: ["a", "b"] }],
    ["a provider", { provider: "groq" }],
    ["a conversation", { conversation: { id: "c" } }],
    ["an agent", { agent: { type: "teammate" } }],
    ["an environment", { environment: { id: "e" } }],
    ["stored output", { store: true }],
    ["a response to resume", { response_id: "r" }],
    ["a mode", { mode: "agent" }],
    ["tools", { tools: [{ type: "web_search" }] }],
    ["a tool choice", { tool_choice: "required" }],
  ])("refuses %s", async (_name, request) => {
    await expect(run(request)).rejects.toMatchObject({ statusCode: 403 });

    expect(mocks.createModelCompletion).not.toHaveBeenCalled();
    expect(mocks.createResponse).not.toHaveBeenCalled();
  });
});

describe("chat completions with any other credential", () => {
  it("leaves a named model alone", async () => {
    vi.clearAllMocks();
    mocks.createModelCompletion.mockResolvedValue(new Response("{}"));

    await createChatCompletionThroughPort({
      context: { env: {} } as ServiceContext,
      request: { messages, model: "named" } as ParsedChatCompletionsPortRequest,
      user,
    });

    expect(mocks.selectModels).not.toHaveBeenCalled();
    expect(mocks.createModelCompletion).toHaveBeenCalledWith(
      expect.objectContaining({ request: expect.objectContaining({ model: "named" }) }),
    );
  });
});
