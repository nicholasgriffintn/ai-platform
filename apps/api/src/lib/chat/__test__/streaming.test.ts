import { beforeEach, describe, expect, it, vi } from "vitest";

import { createServiceContext } from "~/lib/context/serviceContext";

import { createStreamWithPostProcessing } from "../streaming";

const memoryMocks = vi.hoisted(() => ({
  handleMemory: vi.fn(),
  getInstance: vi.fn(),
}));

const chatMocks = vi.hoisted(() => ({
  getAIResponse: vi.fn(),
  handleToolCalls: vi.fn().mockResolvedValue([
    {
      role: "tool",
      name: "get_recipe",
      content: "Recipe configuration fields loaded.",
      status: "success",
      tool_call_id: "call_recipe",
    },
  ]),
}));

const connectorMocks = vi.hoisted(() => ({
  closeComposioConnectorRun: vi.fn(),
}));

vi.mock("~/services/apps/connectors/composio-run", () => ({
  closeComposioConnectorRun: connectorMocks.closeComposioConnectorRun,
}));

vi.mock("~/lib/providers/models", () => ({
  findModelConfig: vi.fn().mockResolvedValue({
    modalities: { input: ["text"], output: ["text"] },
  }),
}));

vi.mock("~/lib/providers/capabilities/guardrails", () => ({
  Guardrails: class {
    validateOutput = vi.fn().mockResolvedValue({ isValid: true });
  },
}));

vi.mock("~/lib/chat/core", () => ({ processChatRequest: vi.fn() }));

vi.mock("~/lib/chat/tools", () => ({ handleToolCalls: chatMocks.handleToolCalls }));

vi.mock("~/lib/chat/responses", () => ({
  getAIResponse: chatMocks.getAIResponse,
  formatAssistantMessage: (params: Record<string, any>) => ({
    content:
      params.thinking || params.signature
        ? [
            ...(params.thinking
              ? [
                  {
                    type: "thinking",
                    thinking: params.thinking,
                    signature: params.signature || "",
                  },
                ]
              : []),
            ...(params.content ? [{ type: "text", text: params.content }] : []),
          ]
        : params.content || "",
    thinking: params.thinking || "",
    signature: params.signature || "",
    citations: params.citations || [],
    tool_calls: params.tool_calls || [],
    data: params.data || null,
    usage: params.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
    guardrails: params.guardrails || { passed: true },
    log_id: params.log_id || null,
    model: params.model || "",
    selected_models: params.selected_models || [],
    platform: params.platform || "api",
    timestamp: params.timestamp || Date.now(),
    id: params.id || "assistant-test-id",
    finish_reason: params.finish_reason || (params.tool_calls?.length ? "tool_calls" : "stop"),
    mode: params.mode,
    refusal: params.refusal || null,
    annotations: params.annotations || null,
  }),
}));

vi.mock("~/lib/memory", () => ({
  MemoryManager: {
    getInstance: memoryMocks.getInstance,
  },
}));

function createProviderStream(events: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();

  return new ReadableStream({
    start(controller) {
      for (const event of events) {
        controller.enqueue(encoder.encode(event));
      }

      controller.close();
    },
  });
}

async function readStream(stream: ReadableStream): Promise<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let output = "";

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    output += decoder.decode(value);
  }

  return output;
}

describe("createStreamWithPostProcessing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    memoryMocks.getInstance.mockReturnValue({
      handleMemory: memoryMocks.handleMemory,
    });
    connectorMocks.closeComposioConnectorRun.mockResolvedValue(undefined);
  });

  it("finalises connector sessions when the provider stream fails mid-flight", async () => {
    const context = {} as never;
    const providerStream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.error(new Error("provider disconnected"));
      },
    });
    const conversationManager = {
      getUsageLimits: vi.fn().mockResolvedValue(null),
      add: vi.fn(),
    };

    const stream = await createStreamWithPostProcessing(
      providerStream,
      {
        env: { AI: {} } as any,
        completion_id: "completion-1",
        model: "gpt-5.4-mini",
        provider: "openai",
        context,
      },
      conversationManager as any,
    );

    await readStream(stream);

    expect(connectorMocks.closeComposioConnectorRun).toHaveBeenCalledOnce();
    expect(connectorMocks.closeComposioConnectorRun).toHaveBeenCalledWith(context);
  });

  it("finalises connector sessions when the stream consumer cancels", async () => {
    const context = {} as never;
    const stream = await createStreamWithPostProcessing(
      new ReadableStream<Uint8Array>(),
      {
        env: { AI: {} } as any,
        completion_id: "completion-1",
        model: "gpt-5.4-mini",
        provider: "openai",
        context,
      },
      { getUsageLimits: vi.fn().mockResolvedValue(null), add: vi.fn() } as any,
    );

    await stream.cancel("client disconnected");
    expect(connectorMocks.closeComposioConnectorRun).toHaveBeenCalledOnce();
    expect(connectorMocks.closeComposioConnectorRun).toHaveBeenCalledWith(context);
  });

  it("stops after provider stream errors without saving an assistant message", async () => {
    const conversationManager = {
      getUsageLimits: vi.fn().mockResolvedValue({
        daily: { used: 13, limit: 50 },
        pro: { used: 11.3, limit: 200 },
      }),
      add: vi.fn(),
    };

    const stream = await createStreamWithPostProcessing(
      createProviderStream([
        `data: ${JSON.stringify({
          error: {
            type: "insufficient_quota",
            code: "insufficient_quota",
            message: "Quota exceeded",
          },
        })}\n\n`,
        "data: [DONE]\n\n",
      ]),
      {
        env: { AI: {} } as any,
        completion_id: "completion-1",
        model: "gpt-5.4-mini",
        provider: "openai",
      },
      conversationManager as any,
    );

    const output = await readStream(stream);

    expect(output.match(/data: \[DONE\]/g)).toHaveLength(1);
    expect(output).toContain('"type":"error"');
    expect(output).not.toContain('"state":"post_processing"');
    expect(output).not.toContain('"type":"message_delta"');
    expect(conversationManager.add).not.toHaveBeenCalled();
  });

  it("tells the user why a streamed response stopped at the usage limit", async () => {
    const conversationManager = {
      getUsageLimits: vi.fn().mockResolvedValue({ daily: { used: 50, limit: 50 } }),
      add: vi.fn(),
      get: vi.fn().mockResolvedValue([]),
    };

    const stream = await createStreamWithPostProcessing(
      createProviderStream([
        `data: ${JSON.stringify({
          choices: [
            {
              delta: {
                tool_calls: [
                  {
                    index: 0,
                    id: "call_recipe",
                    type: "function",
                    function: { name: "get_recipe", arguments: "{}" },
                  },
                ],
              },
            },
          ],
        })}\n\n`,
        "data: [DONE]\n\n",
      ]),
      {
        env: { AI: {} } as any,
        completion_id: "completion-1",
        model: "gpt-5.4-mini",
        provider: "openai",
        max_steps: 5,
        current_step: 1,
      },
      conversationManager as any,
    );

    const output = await readStream(stream);

    expect(output).toContain("reached your usage limit");
  });

  it("stores streamed assistant messages without empty tool calls", async () => {
    const conversationManager = {
      getUsageLimits: vi.fn().mockResolvedValue({
        daily: { used: 13, limit: 50 },
        pro: { used: 11.3, limit: 200 },
      }),
      add: vi.fn(),
    };

    const stream = await createStreamWithPostProcessing(
      createProviderStream([
        `data: ${JSON.stringify({
          choices: [{ delta: { content: "Hello" } }],
        })}\n\n`,
        "data: [DONE]\n\n",
      ]),
      {
        env: { AI: {} } as any,
        completion_id: "completion-1",
        model: "gpt-5.4-mini",
        provider: "openai",
      },
      conversationManager as any,
    );

    await readStream(stream);

    expect(conversationManager.add).toHaveBeenCalledWith(
      "completion-1",
      expect.objectContaining({
        content: "Hello",
        tool_calls: null,
      }),
    );
  });

  it("finalises provider streams that close without a done marker", async () => {
    const conversationManager = {
      getUsageLimits: vi.fn().mockResolvedValue({
        daily: { used: 13, limit: 50 },
        pro: { used: 11.3, limit: 200 },
      }),
      add: vi.fn(),
    };

    const stream = await createStreamWithPostProcessing(
      createProviderStream([
        `event: content_block_delta\ndata: ${JSON.stringify({
          delta: { type: "text_delta", text: "Robots need coffee breaks." },
        })}\n\n`,
        `event: content_block_stop\ndata: ${JSON.stringify({
          index: 0,
          type: "content_block_stop",
        })}\n\n`,
      ]),
      {
        env: { AI: {} } as any,
        completion_id: "completion-1",
        model: "claude-test",
        provider: "anthropic",
        platform: "web",
      },
      conversationManager as any,
    );

    const output = await readStream(stream);

    expect(output).toContain('"type":"message_start"');
    expect(output).toContain('"model":"claude-test"');
    expect(output).toContain('"provider":"anthropic"');
    expect(output).toContain('"state":"post_processing"');
    expect(output).toContain('"type":"message_delta"');
    expect(output).toContain('"type":"message_stop"');
    expect(output).toContain('"state":"done"');
    expect(output).toContain("data: [DONE]");
    expect(conversationManager.add).toHaveBeenCalledWith(
      "completion-1",
      expect.objectContaining({
        content: "Robots need coffee breaks.",
        model: "claude-test",
        platform: "web",
      }),
    );
  });

  it("emits assistant tool calls in message deltas for client replay", async () => {
    const conversationManager = {
      getUsageLimits: vi.fn().mockResolvedValue({
        daily: { used: 13, limit: 50 },
        pro: { used: 11.3, limit: 200 },
      }),
      add: vi.fn(),
    };

    const stream = await createStreamWithPostProcessing(
      createProviderStream([
        `data: ${JSON.stringify({
          choices: [
            {
              delta: {
                tool_calls: [
                  {
                    index: 0,
                    id: "call_recipe",
                    type: "function",
                    function: {
                      name: "get_recipe",
                      arguments: "{}",
                    },
                  },
                ],
              },
            },
          ],
        })}\n\n`,
        "data: [DONE]\n\n",
      ]),
      {
        env: { AI: {} } as any,
        completion_id: "completion-1",
        model: "gpt-5.4-mini",
        provider: "openai",
      },
      conversationManager as any,
    );

    const output = await readStream(stream);

    expect(output).toContain('"type":"message_delta"');
    expect(output).toContain('"tool_calls":[{"id":"call_recipe"');
  });

  it("continues a successful capability discovery without an explicit step budget", async () => {
    const discoveryResult = {
      role: "tool",
      name: "discover_capabilities",
      content: "A connected capability is ready.",
      status: "success",
      tool_call_id: "call_discovery",
      data: { responseType: "hidden" },
    };

    chatMocks.handleToolCalls.mockImplementationOnce(
      async (_completionId, _response, _manager, _request, options) => {
        await options?.onToolResult?.(discoveryResult);

        return [discoveryResult];
      },
    );
    chatMocks.getAIResponse.mockResolvedValueOnce(
      createProviderStream([
        `data: ${JSON.stringify({ choices: [{ delta: { content: "Continuing now." } }] })}\n\n`,
        "data: [DONE]\n\n",
      ]),
    );
    const conversationManager = {
      getUsageLimits: vi.fn().mockResolvedValue(null),
      add: vi.fn(),
      get: vi.fn().mockResolvedValue([
        { role: "user", content: "Send an email" },
        { role: "tool", ...discoveryResult },
      ]),
    };
    const stream = await createStreamWithPostProcessing(
      createProviderStream([
        `data: ${JSON.stringify({
          choices: [
            {
              delta: {
                tool_calls: [
                  {
                    index: 0,
                    id: "call_discovery",
                    type: "function",
                    function: {
                      name: "discover_capabilities",
                      arguments: '{"query":"send an email"}',
                    },
                  },
                ],
              },
            },
          ],
        })}\n\n`,
        "data: [DONE]\n\n",
      ]),
      {
        env: { AI: {} } as any,
        completion_id: "completion-discovery",
        model: "gpt-5.4-mini",
        provider: "openai",
      },
      conversationManager as any,
    );

    const output = await readStream(stream);

    expect(chatMocks.getAIResponse).toHaveBeenCalledOnce();
    expect(conversationManager.get).toHaveBeenCalledOnce();
    expect(output).toContain("Continuing now.");
  });

  it("closes the stream without another model turn while connector approval is pending", async () => {
    const pendingResult = {
      role: "tool",
      name: "use_recipe_connector",
      content: "Approval is required before gmail can create the draft.",
      status: "pending",
      tool_call_id: "call_connector",
      data: {
        approvalRequired: true,
        humanInTheLoop: {
          type: "approval",
          status: "pending",
          requires_user_action: true,
        },
      },
    };

    chatMocks.handleToolCalls.mockImplementationOnce(
      async (_completionId, _response, _manager, _request, options) => {
        await options?.onToolResult?.(pendingResult);

        return [pendingResult];
      },
    );
    const conversationManager = {
      getUsageLimits: vi.fn().mockResolvedValue(null),
      add: vi.fn(),
      get: vi.fn(),
    };
    const stream = await createStreamWithPostProcessing(
      createProviderStream([
        `data: ${JSON.stringify({
          choices: [
            {
              delta: {
                tool_calls: [
                  {
                    index: 0,
                    id: "call_connector",
                    type: "function",
                    function: {
                      name: "use_recipe_connector",
                      arguments: "{}",
                    },
                  },
                ],
              },
            },
          ],
        })}\n\n`,
        "data: [DONE]\n\n",
      ]),
      {
        env: { AI: {} } as any,
        completion_id: "completion-approval",
        model: "gpt-5.4-mini",
        provider: "openai",
        max_steps: 4,
      },
      conversationManager as any,
    );

    const output = await readStream(stream);

    expect(output).toContain('"status":"pending"');
    expect(output).toContain('"state":"done"');
    expect(output.match(/data: \[DONE\]/g)).toHaveLength(1);
    expect(chatMocks.getAIResponse).not.toHaveBeenCalled();
    expect(conversationManager.get).not.toHaveBeenCalled();
  });

  it("grants one corrective stream turn for an unknown artifact tool call", async () => {
    const artifactToolCallEvent = `data: ${JSON.stringify({
      choices: [
        {
          delta: {
            tool_calls: [
              {
                index: 0,
                id: "call_artifact",
                type: "function",
                function: { name: "artifact", arguments: "{}" },
              },
            ],
          },
        },
      ],
    })}\n\n`;
    const recoverableResult = {
      role: "tool",
      name: "artifact",
      content: "Artifacts are response markup, not tools.",
      status: "error",
      tool_call_id: "call_artifact",
      data: { errorCode: "UNKNOWN_TOOL", recoverable: true },
    };

    chatMocks.handleToolCalls.mockResolvedValueOnce([recoverableResult]).mockResolvedValueOnce([
      {
        ...recoverableResult,
        data: { errorCode: "UNKNOWN_TOOL" },
      },
    ]);
    chatMocks.getAIResponse.mockResolvedValueOnce(
      createProviderStream([artifactToolCallEvent, "data: [DONE]\n\n"]),
    );

    const conversationManager = {
      getUsageLimits: vi.fn().mockResolvedValue(null),
      add: vi.fn(),
      get: vi.fn().mockResolvedValue([]),
    };
    const stream = await createStreamWithPostProcessing(
      createProviderStream([artifactToolCallEvent, "data: [DONE]\n\n"]),
      {
        env: { AI: {} } as any,
        completion_id: "completion-1",
        model: "gpt-5.4-mini",
        provider: "openai",
      },
      conversationManager as any,
    );

    const output = await readStream(stream);

    expect(chatMocks.getAIResponse).toHaveBeenCalledTimes(1);
    expect(chatMocks.handleToolCalls).toHaveBeenNthCalledWith(
      1,
      "completion-1",
      expect.any(Object),
      expect.any(Object),
      expect.any(Object),
      expect.objectContaining({ recoverUnknownToolCalls: true }),
    );
    expect(chatMocks.handleToolCalls).toHaveBeenNthCalledWith(
      2,
      "completion-1",
      expect.any(Object),
      expect.any(Object),
      expect.any(Object),
      expect.objectContaining({ recoverUnknownToolCalls: false }),
    );
    expect(output.match(/data: \[DONE\]/g)).toHaveLength(1);
  });

  it("skips automatic memory storage when the model already calls store_memory", async () => {
    const conversationManager = {
      getUsageLimits: vi.fn().mockResolvedValue({
        daily: { used: 13, limit: 50 },
        pro: { used: 11.3, limit: 200 },
      }),
      add: vi.fn(),
      get: vi.fn().mockResolvedValue([
        {
          role: "user",
          content: "Remember that I prefer concise replies",
        },
      ]),
    };

    const stream = await createStreamWithPostProcessing(
      createProviderStream([
        `data: ${JSON.stringify({
          choices: [
            {
              delta: {
                tool_calls: [
                  {
                    index: 0,
                    id: "call_memory",
                    type: "function",
                    function: {
                      name: "store_memory",
                      arguments: JSON.stringify({
                        text: "User prefers concise replies",
                        category: "preference",
                      }),
                    },
                  },
                ],
              },
            },
          ],
        })}\n\n`,
        "data: [DONE]\n\n",
      ]),
      {
        env: { AI: {} } as any,
        completion_id: "completion-1",
        model: "gpt-5.4-mini",
        provider: "openai",
        context: createServiceContext({
          env: { AI: {} } as any,
          user: { id: 42, plan_id: "pro" } as any,
        }),
        userSettings: {
          memories_save_enabled: true,
          memories_chat_history_enabled: true,
        } as any,
      },
      conversationManager as any,
    );

    await readStream(stream);

    expect(memoryMocks.getInstance).not.toHaveBeenCalled();
    expect(memoryMocks.handleMemory).not.toHaveBeenCalled();
  });

  it("stores automatically classified memories in the project scope", async () => {
    memoryMocks.handleMemory.mockResolvedValue([]);
    const context = createServiceContext({
      env: { AI: {} } as any,
      user: { id: 42, plan_id: "pro" } as any,
    });
    const conversationManager = {
      getUsageLimits: vi.fn().mockResolvedValue(null),
      add: vi.fn(),
      get: vi
        .fn()
        .mockResolvedValue([{ role: "user", content: "The launch is scheduled for Friday" }]),
    };

    const stream = await createStreamWithPostProcessing(
      createProviderStream([
        `data: ${JSON.stringify({ choices: [{ delta: { content: "Noted" } }] })}\n\n`,
        "data: [DONE]\n\n",
      ]),
      {
        env: { AI: {} } as any,
        completion_id: "completion-1",
        model: "gpt-5.4-mini",
        provider: "openai",
        context,
        userSettings: { memories_save_enabled: true } as any,
        memoryScope: { type: "project", projectId: "project-1" },
      },
      conversationManager as any,
    );

    await readStream(stream);

    expect(memoryMocks.getInstance).toHaveBeenCalledWith(expect.anything(), context.user, context, {
      type: "project",
      projectId: "project-1",
    });
    expect(memoryMocks.handleMemory).toHaveBeenCalledOnce();
  });
});
