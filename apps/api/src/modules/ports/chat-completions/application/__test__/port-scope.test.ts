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

  it("ignores a conversation hint from the caller", async () => {
    await run({ model_tier: "low" }, "someone-elses-conversation");

    expect(mocks.createModelCompletion).toHaveBeenCalledWith(
      expect.objectContaining({ conversationId: "chat-completions" }),
    );
  });

  it.each([
    ["a named model", { model: "m" }],
    ["a provider", { provider: "groq" }],
    ["a conversation", { conversation: { id: "c" } }],
    ["tools", { tools: [{ type: "web_search" }] }],
  ])("refuses %s", async (_name, request) => {
    await expect(run(request)).rejects.toMatchObject({ statusCode: 403 });

    expect(mocks.createModelCompletion).not.toHaveBeenCalled();
    expect(mocks.createResponse).not.toHaveBeenCalled();
  });
});
