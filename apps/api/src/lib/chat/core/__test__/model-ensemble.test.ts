import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  runAgentLoop: vi.fn(),
  getAIResponse: vi.fn(),
  recordModelTurnUsage: vi.fn(async (_params: { messageId?: string }) => undefined),
  closeComposioConnectorRun: vi.fn(async () => {}),
}));

vi.mock("~/lib/chat/agent/agent-loop", () => ({ runAgentLoop: mocks.runAgentLoop }));
vi.mock("~/lib/chat/streaming/responses", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getAIResponse: mocks.getAIResponse,
}));
vi.mock("~/services/apps/connectors/composio-run", () => ({
  closeComposioConnectorRun: mocks.closeComposioConnectorRun,
}));
vi.mock("~/lib/usage/modelUsage", () => ({
  recordModelTurnUsage: mocks.recordModelTurnUsage,
}));

import type { Message } from "~/types";

import { createModelEnsembleStream } from "../model-ensemble";

const primaryMessage: Message = {
  id: "message-1",
  role: "assistant",
  content: "Primary answer",
  timestamp: 1,
};

function createParams(conversation: Message[]) {
  const conversationManager = {
    getUsageLimits: vi.fn(async () => null),
    releaseTurnReservation: vi.fn(),
    get: vi.fn(async () => conversation),
    update: vi.fn(async () => {}),
  };
  const pending: Promise<unknown>[] = [];

  return {
    conversationManager,
    pending,
    params: {
      completionId: "completion-1",
      usageScopeId: "user-message-1",
      conversationManager,
      toolRequestContext: { context: undefined },
      env: {},
      provider: "test-provider",
      requestParams: {},
      models: [
        { model: "primary-model", provider: "test-provider", displayName: "Primary" },
        { model: "secondary-model", provider: "test-provider", displayName: "Secondary" },
      ],
      executionCtx: {
        waitUntil: (promise: Promise<unknown>) => {
          pending.push(promise);
        },
      },
    } as never,
  };
}

function drain(stream: ReadableStream): Promise<string> {
  return new Response(stream).text();
}

describe("createModelEnsembleStream", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.runAgentLoop.mockResolvedValue({ finalMessage: primaryMessage });
    mocks.getAIResponse.mockResolvedValue({ response: "Secondary answer" });
  });

  it("replaces the stored primary message with the combined answer", async () => {
    const { params, conversationManager, pending } = createParams([
      { id: "message-0", role: "user", content: "Question", timestamp: 0 },
      primaryMessage,
    ]);

    const streamed = await drain(createModelEnsembleStream(params));

    await Promise.all(pending);

    expect(conversationManager.update).toHaveBeenCalledTimes(1);

    const [, stored] = conversationManager.update.mock.calls[0] as unknown as [string, Message[]];
    const replaced = stored.find((message) => message.id === "message-1");

    expect(replaced?.content).toContain("Primary answer");
    expect(replaced?.content).toContain("Secondary answer");
    expect(streamed).toContain("Secondary answer");
    expect(mocks.recordModelTurnUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "secondary-model",
        provider: "test-provider",
        messageId: "ensemble:user-message-1:0:secondary-model",
      }),
    );
  });

  it("does not rewrite the conversation when the primary message is no longer present", async () => {
    const { params, conversationManager, pending } = createParams([
      { id: "message-0", role: "user", content: "Question", timestamp: 0 },
      { id: "message-regenerated", role: "assistant", content: "Primary answer", timestamp: 1 },
    ]);

    const streamed = await drain(createModelEnsembleStream(params));

    await Promise.all(pending);

    expect(conversationManager.update).not.toHaveBeenCalled();
    expect(streamed).toContain("Secondary answer");
  });
});
