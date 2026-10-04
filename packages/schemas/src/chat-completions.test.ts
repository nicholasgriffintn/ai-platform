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

  it("continues to reject unknown request fields", () => {
    expect(() =>
      createChatCompletionsJsonSchema.parse({ model: "gpt-5", messages, unknown_setting: true }),
    ).toThrow();
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

  it("accepts artifact selection content through the selection contract", () => {
    expect(
      createChatCompletionsJsonSchema.parse({
        model: "gpt-5",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "Make this firmer" },
              {
                type: "selection",
                selection: {
                  source: {
                    kind: "artifact",
                    identifier: "launch-plan",
                    type: "text/markdown",
                    title: "Launch plan",
                  },
                  selectedText: "This paragraph needs work.",
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
              type: "selection",
              selection: {
                source: { kind: "artifact", identifier: "launch-plan" },
                selectedText: "This paragraph needs work.",
              },
            },
          ],
        },
      ],
    });
  });

  it("accepts message selection parts with an optional comment", () => {
    expect(
      createChatCompletionsJsonSchema.parse({
        model: "gpt-5",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "selection",
                selection: {
                  source: {
                    kind: "message",
                    messageId: "assistant-1",
                    role: "assistant",
                    runId: "run_1",
                  },
                  selectedText: "This needs a citation.",
                  comment: "Please verify this claim.",
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
            {
              type: "selection",
              selection: {
                source: { kind: "message", messageId: "assistant-1" },
                selectedText: "This needs a citation.",
                comment: "Please verify this claim.",
              },
            },
          ],
        },
      ],
    });
  });

  it("rejects the retired artifact selection content part", () => {
    expect(
      createChatCompletionsJsonSchema.safeParse({
        model: "gpt-5",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "artifact_selection",
                artifact_selection: { selectedText: "retired" },
              },
            ],
          },
        ],
      }).success,
    ).toBe(false);
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
