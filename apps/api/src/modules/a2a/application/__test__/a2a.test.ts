import {
  A2A_ERRORS,
  a2aAgentCardSchema,
  teammateSummarySchema,
} from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it, vi } from "vitest";

import { buildTeammateAgentCard } from "../agent-card";
import { handleA2aMessage, readA2aMessageText } from "../server";

const teammate = teammateSummarySchema.parse({
  id: "teammate-1",
  name: "Ada",
  kind: "colleague",
  description: "Research lead",
  avatarUrl: null,
  characterId: null,
  model: null,
  modelAvailable: true,
  mode: null,
  ownerScopeType: "user",
  skillIds: [],
  toolIds: [],
  unavailableSkillIds: [],
  unavailableToolIds: [],
  scorecard: { good: 0, bad: 0 },
});

describe("A2A teammates", () => {
  it("publishes a valid agent card that points at the teammate's endpoint", () => {
    const card = buildTeammateAgentCard(teammate, "https://api.polychat.app");

    expect(a2aAgentCardSchema.parse(card)).toMatchObject({
      name: "Ada",
      url: "https://api.polychat.app/a2a/teammates/teammate-1",
      capabilities: { streaming: false },
      security: [{ polychatApiKey: [] }],
    });
  });

  it("joins text and data parts, and refuses files and agent-authored messages", () => {
    expect(
      readA2aMessageText({
        kind: "message",
        messageId: "m-1",
        role: "user",
        parts: [
          { kind: "text", text: "Summarise this" },
          { kind: "data", data: { ticket: 42 } },
        ],
      }),
    ).toBe('Summarise this\n\n{"ticket":42}');
    expect(() =>
      readA2aMessageText({
        kind: "message",
        messageId: "m-2",
        role: "user",
        parts: [{ kind: "file", file: { uri: "https://x.test/a.pdf" } }],
      }),
    ).toThrow(expect.objectContaining({ code: A2A_ERRORS.contentTypeNotSupported }));
    expect(() =>
      readA2aMessageText({
        kind: "message",
        messageId: "m-3",
        role: "agent",
        parts: [{ kind: "text", text: "hi" }],
      }),
    ).toThrow("Send messages with the user role");
  });

  it("delivers message/send to the teammate and replies in its conversation", async () => {
    const deliver = vi.fn(async () => ({ text: "On it", conversationId: "conversation-1" }));

    await expect(
      handleA2aMessage(
        {
          jsonrpc: "2.0",
          id: 1,
          method: "message/send",
          params: {
            message: { messageId: "m-1", role: "user", parts: [{ kind: "text", text: "Hello" }] },
          },
        },
        deliver,
      ),
    ).resolves.toMatchObject({
      id: 1,
      result: {
        kind: "message",
        role: "agent",
        parts: [{ kind: "text", text: "On it" }],
        contextId: "conversation-1",
      },
    });
    expect(deliver).toHaveBeenCalledWith("Hello");
  });

  it("answers unsupported A2A methods with the protocol's error codes", async () => {
    const deliver = vi.fn();

    await expect(
      handleA2aMessage({ jsonrpc: "2.0", id: 1, method: "message/stream" }, deliver),
    ).resolves.toMatchObject({ error: { code: A2A_ERRORS.unsupportedOperation } });
    await expect(
      handleA2aMessage({ jsonrpc: "2.0", id: 2, method: "tasks/get" }, deliver),
    ).resolves.toMatchObject({ error: { code: A2A_ERRORS.taskNotFound } });
    await expect(
      handleA2aMessage({ jsonrpc: "2.0", id: 3, method: "message/send" }, deliver),
    ).resolves.toMatchObject({ error: { code: -32602 } });
    expect(deliver).not.toHaveBeenCalled();
  });
});
