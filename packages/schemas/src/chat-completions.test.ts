import { describe, expect, it } from "vitest";

import {
  connectorApprovalIdSchema,
  createChatCompletionsJsonSchema,
  createChatCompletionsResponseSchema,
} from "./chat-completions.js";

const messages = [{ role: "user" as const, content: "Hello" }];

describe("chat completions schema", () => {
  it("shares the connector approval ID contract with request consumers", () => {
    expect(connectorApprovalIdSchema.safeParse("coa_approval-123").success).toBe(true);
    expect(connectorApprovalIdSchema.safeParse("ccs_approval-123").success).toBe(false);
  });

  it("accepts a model tier without an explicit model", () => {
    expect(
      createChatCompletionsJsonSchema.parse({
        model_tier: "high",
        messages,
      }),
    ).toMatchObject({
      model_tier: "high",
    });
  });

  it("accepts a request with neither model nor tier so the default tier applies", () => {
    expect(createChatCompletionsJsonSchema.parse({ messages })).not.toHaveProperty("model_tier");
  });

  it("accepts and strips retired request-level retrieval settings during rollout", () => {
    const parsed = createChatCompletionsJsonSchema.parse({
      model: "gpt-5",
      messages,
      use_rag: true,
      rag_options: { top_k: 8 },
    });

    expect(parsed).not.toHaveProperty("use_rag");
    expect(parsed).not.toHaveProperty("rag_options");
  });

  it("continues to reject unknown request fields", () => {
    expect(() =>
      createChatCompletionsJsonSchema.parse({ model: "gpt-5", messages, unknown_setting: true }),
    ).toThrow();
  });

  it("accepts Astra async tools and explicit prompt-cache controls", () => {
    expect(
      createChatCompletionsJsonSchema.parse({
        model: "gpt-6-astra",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Use the stable context",
                prompt_cache_breakpoint: { mode: "explicit" },
              },
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "slow_lookup",
              parameters: { type: "object" },
              strict: true,
              async: true,
            },
          },
        ],
        prompt_cache_options: { mode: "explicit", ttl: "30m" },
      }),
    ).toMatchObject({
      tools: [{ function: { strict: true, async: true } }],
      prompt_cache_options: { mode: "explicit", ttl: "30m" },
    });
  });

  it("accepts a structured tool interaction resolution", () => {
    expect(
      createChatCompletionsJsonSchema.parse({
        model: "gpt-5",
        messages,
        options: {
          toolInteraction: {
            toolName: "select_council_members",
            response: { memberIds: ["sceptic", "operator"] },
          },
        },
      }),
    ).toMatchObject({
      options: {
        toolInteraction: {
          toolName: "select_council_members",
          response: { memberIds: ["sceptic", "operator"] },
        },
      },
    });
  });

  it("rejects a model tier with an explicit model", () => {
    const result = createChatCompletionsJsonSchema.safeParse({
      model: "gpt-5",
      model_tier: "high",
      messages,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: ["model_tier"],
            message: "model_tier is only valid when no explicit model is provided",
          }),
        ]),
      );
    }
  });

  it("rejects a model tier with explicit multi-model selection", () => {
    const result = createChatCompletionsJsonSchema.safeParse({
      model_tier: "high",
      models: ["gpt-5", "claude-opus"],
      messages,
      use_multi_model: true,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: ["model_tier"],
            message: "model_tier is only valid when no explicit model is provided",
          }),
        ]),
      );
    }
  });

  it("accepts artifact selection message content parts", () => {
    expect(
      createChatCompletionsJsonSchema.parse({
        model: "gpt-5",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "Make this firmer" },
              {
                type: "artifact_selection",
                artifact_selection: {
                  artifact: {
                    identifier: "launch-plan",
                    type: "text/markdown",
                    title: "Launch plan",
                  },
                  selectedText: "This paragraph needs work.",
                  selectionStart: 12,
                  selectionEnd: 38,
                },
              },
            ],
          },
        ],
      }),
    ).toMatchObject({
      messages: [
        {
          content: [
            { type: "text" },
            {
              type: "artifact_selection",
              artifact_selection: {
                selectedText: "This paragraph needs work.",
              },
            },
          ],
        },
      ],
    });
  });

  it("accepts custom conversation mode and platform strings", () => {
    expect(
      createChatCompletionsJsonSchema.parse({
        model: "gpt-5",
        mode: "recipe",
        platform: "desktop",
        messages,
      }),
    ).toMatchObject({
      mode: "recipe",
      platform: "desktop",
    });
  });

  it("accepts compaction post-processing metadata with a durable compaction message", () => {
    expect(
      createChatCompletionsResponseSchema.parse({
        id: "completion-1",
        log_id: "log-1",
        object: "chat.completion",
        created: 1234,
        choices: [
          {
            index: 0,
            message: {
              role: "assistant",
              content: "Done",
            },
            finish_reason: "stop",
          },
        ],
        usage: {
          prompt_tokens: 1,
          completion_tokens: 1,
          total_tokens: 2,
        },
        post_processing: {
          compaction: {
            message: {
              id: "snapshot-1-compaction",
              role: "compaction",
              content: "Context automatically compacted",
              parts: [
                {
                  type: "compaction",
                  status: "completed",
                  label: "Context automatically compacted",
                },
              ],
            },
          },
          steps: [{ step: 1 }],
        },
      }),
    ).toMatchObject({
      post_processing: {
        compaction: {
          message: {
            id: "snapshot-1-compaction",
            role: "compaction",
          },
        },
      },
    });
  });

  it("preserves tool result choice metadata in non-streaming responses", () => {
    const parsed = createChatCompletionsResponseSchema.parse({
      id: "completion-1",
      log_id: "log-1",
      object: "chat.completion",
      created: 1234,
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: "Using tool",
          },
          finish_reason: "stop",
        },
        {
          index: 1,
          message: {
            id: "tool_123",
            log_id: "log-1",
            role: "tool",
            name: "test_tool",
            content: "Tool result",
            parts: [
              {
                type: "tool_result",
                name: "test_tool",
                content: "Tool result",
                status: "success",
              },
            ],
            citations: null,
            data: null,
            status: "success",
            timestamp: "2023-01-01T00:00:00Z",
            tool_call_id: "call-test-tool",
            tool_call_arguments: '{"input":"value"}',
          },
          finish_reason: "tool_result",
        },
      ],
      usage: {
        prompt_tokens: 1,
        completion_tokens: 1,
        total_tokens: 2,
      },
    });

    expect(parsed.choices[1]?.message).toMatchObject({
      id: "tool_123",
      log_id: "log-1",
      role: "tool",
      name: "test_tool",
      tool_call_id: "call-test-tool",
      tool_call_arguments: '{"input":"value"}',
      timestamp: "2023-01-01T00:00:00Z",
    });
  });

  it("rejects malformed compaction post-processing metadata", () => {
    const result = createChatCompletionsResponseSchema.safeParse({
      id: "completion-1",
      log_id: "log-1",
      object: "chat.completion",
      created: 1234,
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: "Done",
          },
          finish_reason: "stop",
        },
      ],
      usage: {
        prompt_tokens: 1,
        completion_tokens: 1,
        total_tokens: 2,
      },
      post_processing: {
        compaction: {
          message: {
            id: "assistant-1",
            role: "assistant",
            content: "Ordinary assistant message",
          },
        },
      },
    });

    expect(result.success).toBe(false);
  });
});
